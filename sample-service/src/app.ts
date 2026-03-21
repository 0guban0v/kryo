import express from "express";

export interface MissionRecord {
  id: string;
  name: string;
  status: "active" | "planned" | "complete";
}

const missions: MissionRecord[] = [
  { id: "sherpa", name: "Sherpa", status: "active" },
  { id: "jackal", name: "Jackal", status: "planned" },
  { id: "otter", name: "Otter", status: "complete" },
];

export const app = express();

app.get("/", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/missions", (_request, response) => {
  response.json(missions);
});
