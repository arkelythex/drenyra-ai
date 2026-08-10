/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Secret resolution — Design 04 "KMS / Key Vault" store role.
 *
 * Production secrets (Ed25519 keys, connector credentials) resolve from a
 * managed vault (AWS KMS, Azure Key Vault, GCP KMS). This module defines the
 * resolver contract plus two bounded implementations:
 *
 *   - EnvSecretResolver  — development/CI; never production-only.
 *   - FileSecretResolver — TEST-ONLY; file-backed, never for production.
 *
 * Secrets must never appear in prompts, logs, or publicly shareable receipts.
 */

/** Resolves a named secret to its value. */
export interface SecretResolver {
	resolveSecret(name: string): Promise<string | undefined>;
}

/** Environment-backed resolver (development/CI; never production-only). */
export class EnvSecretResolver implements SecretResolver {
	constructor(private readonly prefix = "DRENYRA_") {}

	async resolveSecret(name: string): Promise<string | undefined> {
		const value = process.env[`${this.prefix}${name}`];
		return value ?? undefined;
	}
}

/**
 * File-backed resolver — TEST-ONLY. Reads a secret from a file. Explicitly
 * never for production: production resolves from a managed vault (KMS), and
 * file-backed secrets violate Design 04 "KMS / Key Vault".
 */
export class FileSecretResolver implements SecretResolver {
	/** TEST-ONLY marker so production lints/audits can reject file resolvers. */
	readonly testOnly = true;

	constructor(private readonly filePath: string) {}

	async resolveSecret(_name: string): Promise<string | undefined> {
		const { readFileSync } = await import("node:fs");
		try {
			const value = readFileSync(this.filePath, "utf8").trim();
			return value.length > 0 ? value : undefined;
		} catch {
			return undefined;
		}
	}
}

/** A resolver that never resolves anything — the fail-closed default. */
export class NullSecretResolver implements SecretResolver {
	async resolveSecret(_name: string): Promise<string | undefined> {
		return undefined;
	}
}

/** Production KMS guidance (Design 04): the managed-vault adapter contract. */
export const KMS_GUIDANCE = {
	role: "Ed25519 keys and connector secrets resolve from a managed vault",
	required: [
		"AWS KMS / Azure Key Vault / GCP KMS adapter implementing SecretResolver",
		"Key rotation and revocation surfaced through the vault",
		"No secret material in env, files, prompts, logs, or publicly shareable receipts",
	],
	status:
		"adapter pending — EnvSecretResolver and FileSecretResolver (test-only) are the bounded dev surface",
} as const;
