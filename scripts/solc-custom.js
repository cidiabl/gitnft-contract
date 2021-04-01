const path = require("path");
const solc = require("solc");

exports.version = solc.version;

exports.compile = function (inputString) {
  const input = JSON.parse(inputString);
  input.sources = scrubWorkingDirectoryFromKeys(input.sources);
  input.settings.outputSelection = scrubWorkingDirectoryFromKeys(
    input.settings.outputSelection
  );
  return solc.compile(JSON.stringify(input));
};

const workingDirectory = path.resolve(__dirname, "..");

function scrubWorkingDirectoryFromKeys(obj) {
  const cleanObj = {};
  for (const key in obj) {
    cleanObj[key.replace(workingDirectory, ".")] = obj[key];
  }
  return cleanObj;
}
