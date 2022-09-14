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
    minArguments: number;
    isFunction: boolean;
    isVerticallyLarge: boolean;

    constructor(keyword: string, latexTemplate: string | null = null, config: KeywordConfig) {
        this.keyword = keyword;

        this.latexTemplate = latexTemplate ?? "\\" + keyword;
        this.maxArguments = config.maxArguments ?? 0;
        this.minArguments = config.minArguments ?? 0;
        this.isFunction = config.isFunction ?? false;
        this.isVerticallyLarge = config.large ?? false;
    }
}

function escapeRegex(string: string): string {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
}

interface KeywordConfig {
    maxArguments?: number;
    minArguments?: number;
    isFunction?: boolean;
    large?: boolean;
}

export class NexMathKeywords {
    _keywords: Map<string, NexMathKeyword>;

    private static _instance: NexMathKeywords | null = null;

    private constructor() {
        this._keywords = new Map();
    }

    addKeyword(
        keyword: string,
        latexEquivalent: string | null = null,
        config: KeywordConfig = {}
    ): NexMathKeywords {
        this._keywords.set(keyword, new NexMathKeyword(keyword, latexEquivalent, config));

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

    generateRegexExpression(): string {
        return `(${Array.from(this._keywords.keys())
            .map((n) => escapeRegex(n))
            .join("|")})`;
    }

    static getInstance(): NexMathKeywords {
        if (!this._instance) {
            this._instance = new NexMathKeywords()
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
                .addKeyword("Naturals", "\\mathbb{N}")
                .addKeyword("Integers", "\\mathbb{Z}")
                .addKeyword("Complex", "\\mathbb{C}")
                .addKeyword("Rationals", "\\mathbb{Q}")
                .addKeyword("Reals", "\\mathbb{R}")
                .addKeyword("forall")
                .addKeyword("exists")
                .addKeyword("subset", "\\subseteq")
                .addKeyword("supset", "\\supseteq")
                .addKeyword("ssubset", "\\subset")
                .addKeyword("ssupset", "\\subset")
                .addKeyword("in")
                .addKeyword("notin")
                .addKeyword("emptyset", "\\varnothing")
                .addKeyword("union", "\\cup")
                .addKeyword("intersection", "\\cap")
                // Logic
                .addKeyword("not", "\\neg")
                .addKeyword("and", "\\land")
                .addKeyword("or", "\\lor")
                // Arrows
                .addKeyword("<-->", "\\longleftrightarrow")
                .addKeyword("-->", "\\longrightarrow")
                .addKeyword("<--", "\\longleftarrow")
                .addKeyword("to")
                .addKeyword("->", "\\to")
                .addKeyword("gets")
                .addKeyword("<-", "\\gets")
                .addKeyword("implies")
                .addKeyword("=>", "\\implies")
                .addKeyword("impliedby")
                .addKeyword("iff")
                // Special comparisons
                .addKeyword(">=", "\\geq")
                .addKeyword("<=", "\\leq")
                .addKeyword("<<", "\\ll")
                .addKeyword(">>", "\\gg")
                .addKeyword("approx", "\\approx")
                .addKeyword("!=", "\\neq")
                .addKeyword("congruent", "\\cong")
                // Special chracters
                .addKeyword("+", "+")
                .addKeyword("-", "-")
                .addKeyword(">", ">")
                .addKeyword("<", "<")
                .addKeyword(",", ",\\,")
                .addKeyword("'", "'")
                .addKeyword(":", ":")
                .addKeyword("!", "!")
                .addKeyword("*", "\\cdot")
                .addKeyword("cross", "\\times")
                .addKeyword("star", "*")
                .addKeyword("slash", "/")
                .addKeyword("=", "=")
                .addKeyword("...", "\\dots")
                .addKeyword("plusminus", "\\pm")
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
                .addKeyword("sqrt", "\\sqrt{$0}", { maxArguments: 1 })
                .addKeyword("abs", "\\left|$0\\right|", { maxArguments: 1 })
                .addKeyword("norm", "\\left\\Vert $0\\right\\Vert", { maxArguments: 1 })
                .addKeyword("radical", "\\sqrt[$0]{$1}", { maxArguments: 2 })
                .addKeyword("sum", "\\displaystyle\\sum_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("prod", "\\displaystyle\\prod_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("coprod", "\\displaystyle\\coprod_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("int", "\\displaystyle\\int_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("iint", "\\displaystyle\\iint_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("iiint", "\\displaystyle\\iiint_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("lim", "\\displaystyle\\lim_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("bigunion", "\\displaystyle\\bigcup_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("bigintersection", "\\displaystyle\\bigcap_{$0}^{$1}", {
                    maxArguments: 2,
                    large: true,
                })
                .addKeyword("eval", "\\Big|_{$0}^{$1}", { maxArguments: 2, large: true })
                .addKeyword("max", "\\max")
                .addKeyword("min", "\\min")
                .addKeyword("inf", "\\inf")
                .addKeyword("sup", "\\sup")
                // Text annotations
                .addKeyword("vec", "\\vec{$0}", { maxArguments: 1, minArguments: 1 })
                .addKeyword("hat", "\\hat{$0}", { maxArguments: 1, minArguments: 1 })
                .addKeyword("bar", "\\bar{$0}", { maxArguments: 1, minArguments: 1 })
                .addKeyword("tilde", "\\tilde{$0}", { maxArguments: 1, minArguments: 1 })
                .addKeyword("boxed", "\\boxed{$0}", { maxArguments: 1 })
                // Escaped brackets + parentheses
                .addKeyword("\\(", "(")
                .addKeyword("\\)", ")")
                .addKeyword("\\[", "[")
                .addKeyword("\\]", "]");
        }
        return this._instance;
    }
}
