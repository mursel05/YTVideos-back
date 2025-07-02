const express = require("express");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());

function formatVideoTitle(title) {
  let safeTitle = title.replace(/[\\\/:*?"<>|]/g, "");
  safeTitle = safeTitle.replace(/ /g, "-");
  return safeTitle;
}

function getTitle(url) {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp --print "%(title)s" "${url}"`, (error, stdout) => {
      if (error) {
        console.error("Error fetching title:", error.message);
        return reject(null);
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

    const rawTitle = await getTitle(videoUrl);
    if (!rawTitle) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to retrieve video title" });
    }

    const safeTitle = formatVideoTitle(rawTitle);
    const outputPath = `download/${safeTitle}.${audioOnly ? "mp3" : "mp4"}`;

    let command = "";

    if (audioOnly) {
      command = `yt-dlp -o "download/${safeTitle}.%(ext)s" -x --audio-format mp3 --audio-quality 0 "${videoUrl}"`;
    } else {
      const formatSelector = `bestvideo[height<=${videoQuality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${videoQuality}]/best`;
      command = `yt-dlp -o "${outputPath}" -f "${formatSelector}" "${videoUrl}"`;
    }

    exec(command, () => {
      res.status(200).json({
        success: true,
        message: "Download started",
        file: `${protocol}://${host}/download/${safeTitle}.${
          audioOnly ? "mp3" : "mp4"
        }`,
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
