/**
 * Contains definitions for NeX math keywords.
 *
 * A keyword is any special character or character sequence that
 * gets translated into a simple LaTeX expression.
 *
 * For instance, `>=` gets translated into `\geq`.
 */

export class NexMathKeyword {
    keyword: string;
    latexTemplate: string;
    maxArguments: number;

    constructor(keyword: string, latexTemplate: string | null = null, maxArguments: number) {
        this.keyword = keyword;

        this.latexTemplate = latexTemplate ?? "\\" + keyword;
        this.maxArguments = maxArguments;
    }
}

export class NexMathKeywords {
    _keywords: Map<string, NexMathKeyword>;

    private constructor() {
        this._keywords = new Map();
    }

    addKeyword(
        keyword: string,
        latexEquivalent: string | null = null,
        maxArguments = 0
    ): NexMathKeywords {
        this._keywords.set(keyword, new NexMathKeyword(keyword, latexEquivalent, maxArguments));

        return this;
    }

    getKeyword(keyword: string): NexMathKeyword {
        let kw = this._keywords.get(keyword);

        if (!kw) {
            throw new Error(`No keyword "${keyword}"`);
        }

        return kw;
    }

    getKeywords(): NexMathKeyword[] {
        return Array.from(this._keywords.values());
    }

    static populated(): NexMathKeywords {
        return (
            new NexMathKeywords()
                // Greek letters (lowercase)
                .addKeyword("alpha")
                .addKeyword("beta")
                .addKeyword("gamma")
                .addKeyword("delta")
                .addKeyword("epsilon", "\\varepsilon")
                .addKeyword("zeta")
                .addKeyword("eta")
                .addKeyword("theta")
                .addKeyword("iota")
                .addKeyword("kappa")
                .addKeyword("lambda")
                .addKeyword("mu")
                .addKeyword("nu")
                .addKeyword("xi")
                .addKeyword("omicron")
                .addKeyword("pi")
                .addKeyword("rho")
                .addKeyword("sigma")
                .addKeyword("tau")
                .addKeyword("upsilon")
                .addKeyword("phi", "\\varphi")
                .addKeyword("chi")
                .addKeyword("psi")
                .addKeyword("omega")
                // Greek letters (uppercase)
                .addKeyword("Alpha")
                .addKeyword("Beta")
                .addKeyword("Gamma")
                .addKeyword("Delta")
                .addKeyword("Epsilon")
                .addKeyword("Zeta")
                .addKeyword("Eta")
                .addKeyword("Theta")
                .addKeyword("Iota")
                .addKeyword("Kappa")
                .addKeyword("Lambda")
                .addKeyword("Mu")
                .addKeyword("Nu")
                .addKeyword("Xi")
                .addKeyword("Omicron")
                .addKeyword("Pi")
                .addKeyword("Rho")
                .addKeyword("Sigma")
                .addKeyword("Tau")
                .addKeyword("Upsilon")
                .addKeyword("Phi")
                .addKeyword("Chi")
                .addKeyword("Psi")
                .addKeyword("Omega")
                // Sets
                .addKeyword("naturals", "\\mathbb{N}")
                .addKeyword("integers", "\\mathbb{Z}")
                .addKeyword("complex", "\\mathbb{C}")
                .addKeyword("rationals", "\\mathbb{Q}")
                .addKeyword("reals", "\\mathbb{R}")
                .addKeyword("forall")
                .addKeyword("exists")
                .addKeyword("subset", "\\subseteq")
                .addKeyword("supset", "\\supseteq")
                .addKeyword("ssubset", "\\subset")
                .addKeyword("ssupset", "\\subset")
                .addKeyword("notin")
                .addKeyword("emptyset", "\\varnothing")
                // Logic
                .addKeyword("NOT", "\\neg")
                .addKeyword("AND", "\\land")
                .addKeyword("OR", "\\lor")
                // Arrows
                .addKeyword("-->", "\\longrightarrow")
                .addKeyword("<--", "\\longleftarrow")
                .addKeyword("<-->", "\\longleftrightarrow")
                .addKeyword("to")
                .addKeyword("->", "\\to")
                .addKeyword("gets")
                .addKeyword("<-", "\\gets")
                .addKeyword("implies")
                .addKeyword("impliedby")
                .addKeyword("iff")
                // Special chracters
                .addKeyword(" ", " ")
                .addKeyword("+", "+")
                .addKeyword("-", "-")
                .addKeyword(">", ">")
                .addKeyword("<", "<")
                .addKeyword(",", ",\\,")
                .addKeyword("$", "\\$")
                .addKeyword("!", "!")
                .addKeyword("\\", "\\\\")
                .addKeyword("carat", "\\^")
                .addKeyword("*", "\\cdot")
                .addKeyword("cross", "\\times")
                .addKeyword("slash", "/")
                .addKeyword("=", "=")
                .addKeyword("...", "\\cdots")
                .addKeyword("plusminus", "\\pm")
                // Special comparisons
                .addKeyword(">=", "\\geq")
                .addKeyword("<=", "\\leq")
                .addKeyword("<<", "\\ll")
                .addKeyword(">>", "\\gg")
                .addKeyword("approx", "\\approx")
                .addKeyword("!=", "\\neq")
                .addKeyword("congruent", "\\cong")
                // Trigonometric
                .addKeyword("cos", "\\cos")
                .addKeyword("sin", "\\sin")
                .addKeyword("tan", "\\tan")
                .addKeyword("sec", "\\sec")
                .addKeyword("csc", "\\csc")
                .addKeyword("cot", "\\cot")
                .addKeyword("arccos", "\\arccos")
                .addKeyword("arcsin", "\\arcsin")
                .addKeyword("arctan", "\\arctan")
                .addKeyword("arcsec", "\\operatorname{arcsec}")
                .addKeyword("arccsc", "\\operatorname{arccsc}")
                .addKeyword("arccot", "\\operatorname{arccot}")
                .addKeyword("cosh", "\\cosh")
                .addKeyword("sinh", "\\sinh")
                .addKeyword("tanh", "\\tanh")
                .addKeyword("csch", "\\operatorname{csch}")
                .addKeyword("sech", "\\operatorname{sech}")
                .addKeyword("coth", "\\operatorname{coth}")
                .addKeyword("arcsinh", "\\operatorname{arcsinh}")
                .addKeyword("arccosh", "\\operatorname{arccosh}")
                .addKeyword("arctanh", "\\operatorname{arctanh}")
                .addKeyword("arccsch", "\\operatorname{arccsch}")
                .addKeyword("arcsech", "\\operatorname{arcsech}")
                .addKeyword("arccoth", "\\operatorname{arccoth}")
                // Misc symbols
                .addKeyword("aleph", "\\aleph")
                .addKeyword("Re", "\\Re")
                .addKeyword("Im", "\\Im")
                .addKeyword("partial", "\\partial")
                .addKeyword("grad", "\\nabla")
                .addKeyword("infty", "\\infty")
                // Misc functions and argumented notation
                .addKeyword("log", "\\log")
                .addKeyword("ln", "\\ln")
                .addKeyword("sqrt", "\\sqrt{$0}", 1)
                .addKeyword("abs", "\\left|$0\\right|", 1)
                .addKeyword("norm", "\\left\\Vert$0\\right\\Vert", 1)
                .addKeyword("radical", "\\sqrt[$0]{$1}", 2)
                .addKeyword("sum", "\\sum_{$0}^{$1}", 2)
                .addKeyword("prod", "\\prod_{$0}^{$1}", 2)
                .addKeyword("coprod", "\\coprod_{$0}^{$1}", 2)
                .addKeyword("int", "\\int_{$0}^{$1}", 2)
                .addKeyword("iint", "\\iint_{$0}^{$1}", 2)
                .addKeyword("iiint", "\\iiint_{$0}^{$1}", 2)
                .addKeyword("lim", "\\lim_{$0}^{$1}", 2)
                .addKeyword("max", "\\max_{$0}^{$1}", 2)
                .addKeyword("min", "\\min_{$0}^{$1}", 2)
                .addKeyword("inf", "\\inf_{$0}^{$1}", 2)
                .addKeyword("sup", "\\sup_{$0}^{$1}", 2)
                .addKeyword("sup", "\\sup_{$0}^{$1}", 2)
                // Text annotations
                .addKeyword("vec", "\\vec{$0}", 1)
                .addKeyword("hat", "\\hat{$0}", 1)
                .addKeyword("bar", "\\bar{$0}", 1)
                .addKeyword("tilde", "\\tilde{$0}", 1)
                .addKeyword("boxed", "\\boxed{$0}", 1)
        );
    }
}
