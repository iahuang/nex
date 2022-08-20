import { runCLI } from "./nex/cli";
import { setResourcesDirectory } from "./nex/resources";
import { FsUtil } from "./nex/util";

setResourcesDirectory(FsUtil.joinPath(__dirname, "../resources"));
runCLI(process.argv);