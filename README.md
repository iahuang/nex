# NeX

NeX is a markup language with lightweight syntax designed for note-taking and drafting documents, especially for fields of study related to mathematics and computer science.

> **NOTE:** This project is in early development stages. Use with caution.

### Motivation

NeX is designed to be an alternative to LaTeX for a wide variety of similar use cases. NeX greatly reduces the complexity in typing math equations (see **NeX Math**), facilitates the inclusion of a variety of different formatting elements without the need for external packages, and provides ways to create more complex visual elements such as diagrams and graphs using similarly intuitive syntax.

To see examples of NeX syntax, see the `examples/` folder.

## Features

### Currently Implemented
- **Based off Markdown**: NeX aims to largely exist as a superset of Markdown, a common markup syntax. Many syntax rules such as using
astrisks (`*`) for italics and double astrisks (`**`) for bold face should feel familiar (**partially implemented**).

- **Custom math syntax**: NeX uses a custom LaTeX-based syntax for writing math that is designed to feel more intuitive, faster to write, and easier to read,
yet still retain the same flexibility as LaTeX.

- **Desmos integration**: NeX makes use of the Desmos API to allow you to embed Desmos graphs directly into your documents.

- **Theme support**: NeX includes several themes to customize the look of your documents. You can also easily create your own themes using plain CSS.

### Planned for Initial Release
- **Syntax highlighting**: Include code blocks with automatic syntax highlighting
- **Offline documents**: NeX can generate standalone HTML documents that can be viewed without Internet access; external media such as images will be automatically bundled with the HTML file.
- **Visual Studio Code Integration**: NeX has a VS Code extension to enable autocomplete, syntax highlighting, and more.
- **Pages**: NeX can generate nested document structures into a single HTML file that provides built-in navigation between pages and the ability to search all pages at once.
- **Live editing**: NeX will display the rendered contents of a NeX document inside of a webpage that automatically hot-reloads to reflect changes without manually having to rebuild an HTML file.

### Planned for Future Releases
- **Diagrams**: Create embedded diagrams in your document using intuitive syntax.

## Installation

You need to have Node.js (v14 or higher) installed to run NeX. 
1. [Download](https://github.com/iahuang/nex/archive/refs/heads/master.zip) this repository, then `cd` to the downloaded copy of this repository.
2. Run `npm install`.
3. Run `tsc`.
4. Run `npm link`. This command may require elevated privileges.
5. Run `nex help` to confirm that NeX is working.

## Introduction to NeX

NeX is designed to mimic much of the syntax of markdown. In other words, almost all standard markdown syntax will work as expected in NeX. To start, create a NeX called `hello.nex`. Type the following into the file,

```
Hello, world!
```

and run `nex build hello.nex`. NeX should output an HTML file called `hello.html`. If you open it, you should see a plain white page containing the words "Hello, world!".

### The NeX CLI

`nex build [file]` will convert a NeX file into a standalone HTML file with any external assets bundled by default into the HTML code itself as base-64 data. This HTML file can then be viewed by itself on any device with or without internet*. Keep in mind, however, that while this HTML file is standalone, it will still require Javascript to be viewed properly. 

*\*Any URL links or URL-linked images will still require an internet connection to view properly.*

### NeX Math

NeX Math is NeX's alternative to LaTeX math syntax. NeX math focuses more on user-friendliness, readability, and conciseness rather than syntactical rigor.

Note that NeX Math is whitespace agnostic, similar to LaTeX (i.e. there is no semantic difference between `x+1`, `x+ 1` and `x     + 1`)

Here are some examples of NeX math and their corresponding LaTeX expressions:

### Simple Fractions
```
1 + 1/x
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=1%2B%5Cfrac%7B1%7D%7Bx%7D)

### Multi-Term Fractions
```
1 + (x+1)/x
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=1%2B%5Cfrac%7Bx%2B1%7D%7Bx%7D)

Notice that the parentheses defining where the numerator `x+1` starts and ends are automatically removed. If you wanted to keep the parentheses, you would do this:

```
1 + ((x+1))/x
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=1%2B%5Cfrac%7B%28x%2B1%29%7D%7Bx%7D)

### Polynomials
```
3x^2 + 2x + 1
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=3x%5E2%20%2B%202x%20%2B%201)

### Trigonometry
```
1 + cos x
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=1%2B%5Ccos%20x)

### Square roots
```
sqrt(x+1)
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=%5Csqrt%7Bx%2B1%7D)

### Logarithms
```
log_b a = (ln a)/(ln b)
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=%5Clog_b%20a%3D%5Cfrac%7B%5Cln%20a%7D%7B%5Cln%20b%7D)

### Greek letters
```
A=pi r^2
```
![Equation](https://latex.userstatic.com/api/render.svg?tex=A%3D%5Cpi%20r%5E2)