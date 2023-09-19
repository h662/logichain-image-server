import "dotenv/config";

import express, { json, urlencoded } from "express";
import { S3Client } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import Path from "path";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

const s3Config = new S3Client({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
});

export const upload = multer({
  storage: multerS3({
    s3: s3Config,
    bucket: "logichain-image-server-2",
    key: (req, file, cb) => {
      cb(
        null,
        `${file.fieldname}-${Date.now()}${Path.extname(file.originalname)}`
      );
    },
  }),
});

const app = express();
const port = 3010;

app.use(json());
app.use(urlencoded({ extended: true }));

// user check
app.get("/", async (req, res) => {
  try {
    const address = req.headers["device-address"] as string;

    const images = await client.image.findMany({
      where: {
        device: {
          address,
        },
      },
    });

    return res.json({ ok: true, images });
  } catch (error) {
    console.error(error);
  }
});

// user check
app.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const image = await client.image.findUnique({
      where: {
        id: +id,
      },
    });

    if (!image) {
      return res.json({ ok: false, message: "Not exist id." });
    }

    return res.json({ ok: true, image });
  } catch (error) {
    console.error(error);
  }
});

// deviceId: 1 -> deviceAddress
app.post("/", upload.single("image"), async (req, res) => {
  try {
    const file = req.file as Express.MulterS3.File;

    const image = await client.image.create({
      data: {
        url: file.location,
        deviceId: 1,
      },
    });

    return res.json({
      ok: true,
      image,
    });
  } catch (error) {
    console.error(error);
  }
});

// auth
app.delete("/:id", async (req, res) => {
  try {
    const address = req.headers["device-address"] as string;
    const { id } = req.params;

    if (!address) {
      res.json({ ok: false, message: "Not exist address." });
    }

    const device = await client.device.findUnique({
      where: {
        address,
      },
    });

    const image = await client.image.findUnique({
      where: {
        id: +id,
      },
    });

    if (!device || !image || device.id !== image.deviceId) {
      return res.json({
        ok: false,
        message: "Not delete.",
      });
    }

    const deletedImage = await client.image.delete({
      where: {
        id: image.id,
      },
    });

    return res.json({
      ok: true,
      deletedImage,
    });
  } catch (error) {
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is listening on port: ${port}`);
});
