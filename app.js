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
  let safeTitle = title
    .replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ""
    )
    .replace(/[^\u0000-\u007F]/g, "")
    .replace(/[\\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!safeTitle || safeTitle.length === 0) {
    safeTitle = "video-" + Date.now();
  }

  if (safeTitle.length > 30) {
    safeTitle = safeTitle.substring(0, 30);
  }

  return safeTitle;
}

function getTitle(url) {
  return new Promise((resolve, reject) => {
    const cookiesFile = path.join(__dirname, "cookies.txt");
    let command = `yt-dlp --cookies "${cookiesFile}" --print "%(title)s" "${url}"`;

    exec(command, (error, stdout) => {
      if (error) {
        console.log("Error fetching title:", error);
        return reject(error);
      }
      resolve(stdout.trim());
    });
  });
}

app.use("/download", express.static(path.join(__dirname, "download")));

app.get("/test", async (req, res) => {
  let safeTitle = "";
  try {
    let rawTitle = await getTitle(
      "https://youtu.be/CH50zuS8DD0?si=bdde62F5g57OcEzi"
    );
    safeTitle = formatVideoTitle(rawTitle);
  } catch (error) {
    console.log("Error testing:", error);
    return res.status(500).json({ success: false, message: "Error testing" });
  }
  if (safeTitle == "1-Minute-Timer") {
    res.status(200).json({
      success: true,
      message: "Server is working",
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Server is not working",
    });
  }
});

app.post("/get-video-title", async (req, res) => {
  try {
    const videoUrl = req.body.url;
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
    res.status(200).json({
      success: true,
      data: {
        title: safeTitle,
      },
    });
  } catch (error) {
    console.log("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post("/download-video", async (req, res) => {
  try {
    const videoUrl = req.body.url;
    const videoQuality = req.body.quality || "1080";
    const audioOnly = req.body.audio || false;
    let videoTitle = req.body.title || "";
    const host = req.get("host");

    if (!videoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Video URL is required" });
    }

    if (["360", "480", "720", "1080"].indexOf(videoQuality) === -1) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid video quality. Allowed values are 360, 480, 720, 1080",
      });
    }

    if (!videoTitle) {
      let rawTitle;
      try {
        rawTitle = await getTitle(videoUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to retrieve video title",
        });
      }
      videoTitle = formatVideoTitle(rawTitle);
    }
    const outputPath = `download/${videoTitle}.${audioOnly ? "mp3" : "mp4"}`;
    const cookiesFile = path.join(__dirname, "cookies.txt");

    let command = "";

    if (audioOnly) {
      command = `yt-dlp --cookies "${cookiesFile}" -o "download/${videoTitle}.%(ext)s" -x --audio-format mp3 --audio-quality 0 "${videoUrl}"`;
    } else {
      const formatSelector = `bestvideo[height<=${videoQuality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${videoQuality}]/best`;
      command = `yt-dlp --cookies "${cookiesFile}" -o "${outputPath}" -f "${formatSelector}" "${videoUrl}"`;
    }

    exec(command, () => {
      res.status(200).json({
        success: true,
        data: {
          url: `https://${host}/download/${videoTitle}.${
            audioOnly ? "mp3" : "mp4"
          }`,
          audio: audioOnly,
          name: videoTitle,
        },
      });
    });
  } catch (error) {
    console.log("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
