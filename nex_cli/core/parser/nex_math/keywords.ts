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
    latexEquivalent: string;

    constructor(keyword: string, latexEquivalent: string | null = null) {
        this.keyword = keyword;

        this.latexEquivalent = latexEquivalent ?? "\\" + keyword;
    }
}

export class NexMathKeywords {
    _keywords: Map<string, NexMathKeyword>;

    private constructor() {
        this._keywords = new Map();
    }

    addKeyword(keyword: string, latexEquivalent: string | null = null): NexMathKeywords {
        this._keywords.set(keyword, new NexMathKeyword(keyword, latexEquivalent));

        return this;
    }

    getLatexCode(keyword: string): string {
        let kw = this._keywords.get(keyword);

        if (!kw) {
            throw new Error(`No keyword "${keyword}"`);
        }

        return kw.latexEquivalent;
    }

    getKeywords(): NexMathKeyword[] {
        return Array.from(this._keywords.values());
    }

    static populated(): NexMathKeywords {
        return new NexMathKeywords()
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
            .addKeyword("Ssi")
            .addKeyword("Omega")
            .addKeyword("plusminus", "\\pm")
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
            .addKeyword("to")
            .addKeyword("gets")
            .addKeyword("implies")
            .addKeyword("impliedby")
            .addKeyword("iff")
            .addKeyword("+", "+")
            .addKeyword("-", "-")
            .addKeyword("$", "\\$")
            .addKeyword("!", "!")
            .addKeyword("\\", "\\\\")
            .addKeyword("carat", "\\^")
            .addKeyword("*", "\\cdot")
            .addKeyword(">=", "\\geq")
            .addKeyword("<=", "\\leq")
            .addKeyword("<<", "\\ll")
            .addKeyword(">>", "\\gg")
            .addKeyword("approx", "\\approx")
            .addKeyword("!=", "\\neq")
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
            .addKeyword("log", "\\log")
            .addKeyword("ln", "\\ln")
    }
}
