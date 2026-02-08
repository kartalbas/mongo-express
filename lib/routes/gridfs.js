import Busboy from '@fastify/busboy';
import mongo from 'mongodb';
import * as utils from '../utils.js';

const routes = function () {
  const exp = {};

  // view all files in a bucket
  exp.viewBucket = function (req, res) {
    const { bucketName, dbName, files } = req;
    let columns = ['filename', 'length']; // putting these here keeps them at the front/left

    const statsAvgChunk  = utils.bytesToSize(files.reduce((prev, curr) => prev + curr.chunkSize, 0) / files.length);
    const statsTotalSize = utils.bytesToSize(files.reduce((prev, curr) => prev + curr.length, 0));

    // Iterate through files for a cleanup
    for (const f in files) {
      columns.push(Object.keys(files[f]));                        // Generate an array of columns used by all documents visible on this page
      files[f].length     = utils.bytesToSize(files[f].length);   // Filesizes to something more readable
      delete files[f].chunkSize;                                   // Already taken the average above, no need;
    }

    columns = columns.flat()
      .filter((value, index, arr) => arr.indexOf(value) === index);  // Remove duplicates
    columns.splice(columns.indexOf('_id'), 1);
    columns.splice(columns.indexOf('chunkSize'), 1);

    const ctx = {
      buckets: res.locals.gridFSBuckets[dbName],
      columns,
      files,
      csrfToken: req.csrfToken(),
      title: 'Viewing Bucket: ' + bucketName,
      stats: {
        avgChunk: statsAvgChunk,
        totalSize: statsTotalSize,
      },
    };

    res.render('gridfs', ctx);
  };

  // upload a file
  exp.addFile = function (req, res) {
    const busboy = new Busboy({ headers: req.headers });
    const bucket = new mongo.GridFSBucket(req.db, { bucketName: req.bucketName });

    busboy.on('file', function (fieldname, file, filename, info) {
      if (!filename) {
        req.session.error = 'No filename.';
        return res.redirect('back');
      }

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: info.mimeType,
      });
      file.pipe(uploadStream);

      uploadStream.on('error', function (err) {
        console.error(err);
        req.session.error = 'Error: ' + err;
      });

      uploadStream.on('finish', function () {
        req.session.success = 'File uploaded!';
        setTimeout(function () {
          return res.redirect('back');
        }, 500);
      });
    });

    req.pipe(busboy);
  };

  // download a file
  exp.getFile = async function (req, res) {
    const bucket = new mongo.GridFSBucket(req.db, { bucketName: req.bucketName });

    try {
      const files = await req.db.collection(req.bucketName + '.files').find({ _id: req.fileID }).toArray();

      if (!files || files.length === 0) {
        console.error('No file');
        req.session.error = 'File not found!';
        return res.redirect('back');
      }

      const file = files[0];
      res.set('Content-Type', file.contentType);
      res.set('Content-Disposition', 'attachment; filename="' + encodeURI(file.filename) + '"');

      const readStream = bucket.openDownloadStream(file._id);

      readStream.on('error', function (err) {
        console.error('Got error while processing stream ' + err.message);
        req.session.error = 'Error: ' + err;
        res.end();
      });

      readStream.pipe(res);
    } catch (err) {
      console.error(err);
      req.session.error = 'Error: ' + err;
      return res.redirect('back');
    }
  };

  // delete a file
  exp.deleteFile = async function (req, res) {
    const bucket = new mongo.GridFSBucket(req.db, { bucketName: req.bucketName });

    try {
      await bucket.delete(req.fileID);
      req.session.success = 'File _id: "' + req.fileID + '" deleted! ';
      setTimeout(function () {
        return res.redirect('back');
      }, 500);
    } catch (err) {
      req.session.error = 'Error: ' + err;
      return res.redirect('back');
    }
  };

  // add bucket
  exp.addBucket = function (req, res) {
    req.session.error('addBucket not implemented yet');
    res.redirect('back');
  };

  // delete bucket
  exp.deleteBucket = function (req, res) {
    req.session.error('deleteBucket not implemented yet');
    res.redirect('back');
  };

  exp.renameBucket = function (req, res) {
    req.session.error('renameBucket not implemented yet');
    res.redirect('back');
  };

  return exp;
};

export default routes;
