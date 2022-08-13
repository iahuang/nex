import { runCLI } from "./nex/cli";
import { FsUtil } from "./nex/util";

runCLI(process.argv, FsUtil.joinPath(__dirname, "../resources"));