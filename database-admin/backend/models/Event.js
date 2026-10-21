const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    venue: { type: String, required: true },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    bannerUrl: { type: String, default: "" },
    registrationFormUrl: { type: String, default: "" },
    capacity: { type: Number, default: 0 }, // 0 = unlimited
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    eligibility: { type: String, default: "" },
    participationType: {
      type: String,
      enum: ["individual", "team"],
    },
    teamSize: { type: Number },
    prizes: { type: String, default: "" },
    coordinators: [
      {
        _id: false,
        name: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
      },
    ],
    registrationDeadline: { type: Date },
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });

module.exports = mongoose.model("Event", eventSchema);
