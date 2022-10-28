const core = require('@actions/core');
var fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const client = new S3Client();
const allowFolderOverwrite = core.getInput('allowFolderOverwrite') | false;
const uploadedFolderName = core.getInput('uploadedFolderName')
const folder = core.getInput('folder')
const bucket = core.getInput('bucket');

async function checkFolderExist(uploadedFolderName) {
    return await client.send(new ListObjectsCommand({ Bucket: bucket, Prefix: `${uploadedFolderName}/`, MaxKeys: 1 }));
}

(async () => {
    try {
        if (!allowFolderOverwrite) {
            const isFolderExist = await checkFolderExist(uploadedFolderName);
            if (isFolderExist.hasOwnProperty('Contents')) throw (`The allowFolderOverwrite is set to false and there is already a folder! Folder name: ${uploadedFolderName}`)
        }
        const folderPath = path.resolve(folder);
        console.log(folder)

        //Read all files from the folder and uploads each of them into S3 under the specified uploadedFolderName folder
        const resoultForAllTheFileUploadsInTheFolder = await new Promise((resolveFolder, rejectFolder) => {
            fs.readdir(folderPath, (err, filenames) => {
                if (err) {
                    rejectFolder(err);
                    return;
                }
                try {
                    let fileReadsPromiseArray = [];
                    filenames.forEach(filename => {
                        fileReadsPromiseArray.push(new Promise((resolveFile, rejectFile) => {
                            fs.readFile(folderPath + "/" + filename, 'utf-8', async (err, content) => {
                                if (err) {
                                    rejectFile(err);
                                    return;
                                }
                                console.log(content)
                                try {
                                    const response = await client.send(new PutObjectCommand({
                                        Bucket: bucket,
                                        Key: "foldertest/" + filename,
                                        Body: content
                                    }));
                                    if (response['$metadata'].httpStatusCode != 200) {
                                        rejectFile(response['$metadata'].httpStatusCode)
                                        return;
                                    }
                                    resolveFile(response['$metadata'].httpStatusCode);
                                } catch (err) {
                                    rejectFile(err)
                                }
                            });
                        }))
                    });
                    Promise.all(fileReadsPromiseArray).then((values) => {
                        resolveFolder();
                    }).catch((error) => {
                        console.log("AWS SDK error - error during file upload:");
                        rejectFolder(error)
                    });
                } catch (err) {
                    rejectFolder(err)
                }
            });
        })

    } catch (err) {
        console.log(err)
        core.setFailed(err.message)
    }
    console.log(`Files uploaded successfully under this folder: ${uploadedFolderName}! :)`)
})()


