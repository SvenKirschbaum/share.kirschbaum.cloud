//This script processes all json schema files and generated corresponding validators and their type declarations

const glob = require("glob");
const ts = require("typescript");
const standaloneCode = require("ajv/dist/standalone");
const path = require("node:path");
const fs = require("node:fs");
const addFormats = require("ajv-formats");
const Ajv = require("ajv/dist/2020");
const schemaToTs = require('json-schema-to-typescript');

const ajv = new Ajv({
    allErrors: true,
    useDefaults: "empty",
    strict: true,
    code: {
        esm: true,
        source: true
    }
})
addFormats(ajv);

//Read all Schema files
let meta = glob.globSync('../src/schemas/*.schema.json', {
        cwd: __dirname,
        absolute: true
    })
    .map(file => {
        return {
            filename: file,
            schema: JSON.parse(fs.readFileSync(file))
        }
    })

//Calculate dependant data
meta = meta.map(schema => {
    const dir = path.dirname(schema.filename);
    const fileName = path.basename(schema.filename);
    const validatorName = fileName.replace(/\.schema\.json$/, '.validator.js');
    const declarationFileName = fileName.replace(/\.schema\.json$/, '.validator.d.ts');
    const interfaceFileName = fileName.replace(/\.schema\.json$/, '.interface.ts');

    return {
        id: schema.schema.$id,
        dir,
        fileName,
        validatorName,
        declarationFileName,
        interfaceFileName,
        ...schema
    }
})

//Parse schema and add to ajv catalogue
meta.forEach(schema => ajv.addSchema(schema.schema, schema.id))

//Generate validator code and save to file
meta.forEach(schema => {
    const code = standaloneCode(ajv, ajv.getSchema(schema.id));
    fs.writeFileSync(path.join(schema.dir, schema.validatorName), code)
});

//Generate validator typing declarations
const tsOptions = {
    allowJs: true,
    declaration: true,
    emitDeclarationOnly: true,
};
const createdFiles = {}
const host = ts.createCompilerHost(tsOptions);
host.writeFile = (fileName, contents) => createdFiles[fileName] = contents;

const program = ts.createProgram(meta.map(schema => path.join(schema.dir, schema.validatorName)), tsOptions, host);
program.emit();


Object.entries(createdFiles).forEach(entry  => {
    const [key, value] = entry;
    fs.writeFileSync(key, value);
})

//Generate typescript interfaces
const interfaceOptions = {
    additionalProperties: false,
    declareExternallyReferenced: true,
    $refOptions: {
        resolve: {
            file: false,
            http: false,
            custom: {
                canRead: /^https:\/\/share\.kirschbaum\.cloud\/schemas\//i,
                order: 1,
                read: (file) => {
                    return JSON.stringify(ajv.getSchema(file.url).schema);
                }
            }
        }
    }
}

meta.forEach(async schema => {
    schemaToTs.compile(schema.schema, schema.schema.title, interfaceOptions).then(ts => fs.writeFileSync(path.join(schema.dir, schema.interfaceFileName), ts));
})
