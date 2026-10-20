import "dotenv/config";
import { checkEmailConfig, sendSignupOtpEmail, describeMailError } from "./emailService.js";

const cfg = checkEmailConfig();
console.log(cfg);

const to = process.argv[2];
if (to && cfg.ok) {
  sendSignupOtpEmail(to, "123456")
    .then(() => console.log("SENT"))
    .catch((e) => console.log(describeMailError(e)));
}