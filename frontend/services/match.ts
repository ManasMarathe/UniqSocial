import api from "./api";
import type { MatchResponse } from "../types";

export async function getTodayMatch(): Promise<MatchResponse> {
  const { data } = await api.get<MatchResponse>("/match/today");
  return data;
}

export async function findMatch(): Promise<MatchResponse> {
  const { data } = await api.post<MatchResponse>("/match/find");
  return data;
}
