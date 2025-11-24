export interface BallState {
  id: number;
  mass: number; // kg
  velocity: number; // m/s
  position: number; // meters (relative to track)
  color: string;
  radius: number;
}

export interface SimulationConfig {
  elasticity: number; // 0 to 1 (0 = perfectly inelastic, 1 = perfectly elastic)
  isPlaying: boolean;
  timeScale: number;
}

export interface SimulationDataPoint {
  time: number;
  v1: number;
  v2: number;
  totalMomentum: number;
  totalKineticEnergy: number;
}

export enum AnalysisStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}