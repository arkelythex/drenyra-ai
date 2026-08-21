export const DOM = {
  query(selector) { return document.querySelector(selector); },
  all(selector) { return [...document.querySelectorAll(selector)]; },
  create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  },
  replace(container, children) { container.replaceChildren(...children); },
};
