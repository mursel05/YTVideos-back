const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());

const downloadDir = path.join(__dirname, "download");
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

function formatVideoTitle(title) {
  let safeTitle = title.replace(/[\\\/:*?"<>|]/g, "");
  safeTitle = safeTitle.replace(/ /g, "-");
  return safeTitle;
}

function getTitle(url) {
  return new Promise((resolve, reject) => {
    const cookiesFile = path.join(__dirname, "cookies.txt");
    let command = `yt-dlp --cookies "${cookiesFile}" --print "%(title)s" "${url}"`;

    exec(command, (error, stdout) => {
      if (error) {
        console.error("Error fetching title:", error);
        return reject(error);
      }
      resolve(stdout.trim());
    });
  });
}

app.use("/download", express.static(path.join(__dirname, "download")));

app.post("/download-video", async (req, res) => {
  try {
    const videoUrl = req.body.url;
    const videoQuality = req.body.quality || "1080";
    const audioOnly = req.body.audio || false;
    const protocol = req.protocol;
    const host = req.get("host");

    if (!videoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Video URL is required" });
    }

    let rawTitle;
    try {
      rawTitle = await getTitle(videoUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to retrieve video title",
      });
    }

    const safeTitle = formatVideoTitle(rawTitle);
    const outputPath = `download/${safeTitle}.${audioOnly ? "mp3" : "mp4"}`;
    const cookiesFile = path.join(__dirname, "cookies.txt");

    let command = "";

    if (audioOnly) {
      command = `yt-dlp --cookies "${cookiesFile}" -o "download/${safeTitle}.%(ext)s" -x --audio-format mp3 --audio-quality 0 "${videoUrl}"`;
    } else {
      const formatSelector = `bestvideo[height<=${videoQuality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${videoQuality}]/best`;
      command = `yt-dlp --cookies "${cookiesFile}" -o "${outputPath}" -f "${formatSelector}" "${videoUrl}"`;
    }

    exec(command, () => {
      res.status(200).json({
        success: true,
        file: `${protocol}://${host}/download/${safeTitle}.${
          audioOnly ? "mp3" : "mp4"
        }`,
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
