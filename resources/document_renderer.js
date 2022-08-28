/**
 * This script is injected at the end of every NeX-generated HTML file and is used
 * to render certain elements such as LaTeX and syntax-highlighted code blocks.
 */

for (let element of document.querySelectorAll(".inline-math")) {
    katex.render(element.textContent, element, {
        throwOnError: false,
    });
}

for (let element of document.querySelectorAll(".block-math")) {
    katex.render(element.textContent, element, {
        throwOnError: false,
        displayMode: true,
    });
}

for (let element of document.querySelectorAll(".calculator")) {
    let calculator = Desmos.GraphingCalculator(element, { expressions: false });
    calculator.setExpression({ id: "graph1", latex: element.dataset.equation });
}

hljs.highlightAll();
