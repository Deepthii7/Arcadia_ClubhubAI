const mongoose = require("mongoose");

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const externalUrl = {
  type: String,
  trim: true,
  validate: {
    validator: (value) => !value || isHttpUrl(value),
    message: "URL must use HTTP or HTTPS",
  },
};

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["Technical", "Non-Technical"],
    },
    logoUrl: { type: String, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    tagline: { type: String, trim: true },
    facultyCoordinator: { type: String, trim: true },
    teamMembers: { type: [teamMemberSchema], default: undefined },
    domains: { type: [String], default: undefined },
    memberCount: { type: Number, min: 0, default: undefined },
    meetingFrequency: { type: String, trim: true },
    linkedinUrl: externalUrl,
    recruitmentStatus: {
      type: String,
      enum: ["Open", "Closed"],
    },
    recruitmentFormUrl: externalUrl,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Club", clubSchema);
