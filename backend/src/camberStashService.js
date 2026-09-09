const http = require("https");
const fs = require("fs");
const path = require("path");

class CamberStashService {
  constructor(apiKey = process.env.CAMBER_API_KEY || "") {
    this.apiKey = apiKey;
    this.apiBase = "api-v2.cambercloud.com";
  }

  /**
   * List files/directories in user's Camber Stash cloud storage
   */
  async listStash(stashPath = "") {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ path: stashPath });
      const req = http.request({
        hostname: this.apiBase,
        path: "/api/cli/stash",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            reject(new Error("Failed to parse Camber Stash response"));
          }
        });
      });

      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = {
  CamberStashService,
  defaultCamberStashService: new CamberStashService()
};
