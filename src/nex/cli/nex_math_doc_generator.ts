import { NexMathKeywords } from "../parser/nex_math/keywords";
import { StringBuffer } from "../util";

const EXAMPLES = [
    "1+2=3",
    "a^2+b^2=c^2",
    "A=pi r^2",
    "1/2",
    "x+1/2",
    "(x+1)/2",
    "((x+1))/2",
    "(x+1)/(x+2)",
    "x=(-b plusminus sqrt(b^2-4ac))/2a",
    "lim(x->infty) f(x)",
    "int(a,b)f(x)dx",
    "mat([a,b,c][d,e,f][g,h,i])",
    "cos x+sin x",
    "forall n in Naturals, exists n+1 in Naturals",
    '"relu"(x)=cases(0 when x<=0, 1 when "otherwise")',
    "d/dx e^x=e^x",
    "n_1+n_2+...+n_i",
    "(x+1/2)(x+1)",
];

export function generateNeXMathDocumentation(): string {
    let keywords = NexMathKeywords.getInstance();

    let output = new StringBuffer();

    output.writeln(":title NeX Math Documentation");

    output.writeln("# Syntax Examples");
    output.writeln("@table {");

    for (let example of EXAMPLES) {
        output.writeln("@row {");
        output.writeln("`" + example + "`");
        output.writeln("");
        output.writeln("${" + example + "}");
        output.writeln("}");
    }

    output.writeln("}");

    output.writeln("# Keywords and Symbols");
    output.writeln("@table {");

    output.writeln(`
@row {
    **Usage**

    **LaTeX equivalent**

    **Output**

    **Takes arguments?**
}
    `);

    for (let keyword of keywords.getKeywords()) {
        let template = keyword.latexTemplate;
        let placeholders = ["a", "b", "c", "d"];

        for (let i = 0; i < keyword.maxArguments; i++) {
            template = template.replaceAll("$" + i, placeholders[i]);
        }
        let example = keyword.keyword;
        if (keyword.maxArguments > 0) {
            example += "(";

            for (let i = 0; i < keyword.maxArguments; i++) {
                example += placeholders[i];

                if (i < keyword.maxArguments - 1) {
                    example += ", ";
                }
            }
            
            example += ")";
        }

        output.writeln("@row {");
        output.writeln("`" + example + "`");
        output.writeln("");
        output.writeln("`" + template + "`");
        output.writeln("");
        output.writeln("${" + example + "}");
        output.writeln("");
        if (keyword.maxArguments > 0) {
            output.writeln(`Yes (max ${keyword.maxArguments} arguments)`);
        } else {
            output.writeln("No")
        }
        output.writeln("}");
    }

    output.writeln("}");

    return output.read();
}
