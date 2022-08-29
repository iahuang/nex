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
    let blockID = element.dataset.id;
    let equations = documentMetadata["desmos-" + blockID];

    let i = 0;
    for (let eq of equations) {
        calculator.setExpression({ id: "graph" + i, latex: eq });
        i += 1;
    }
}

hljs.highlightAll();
