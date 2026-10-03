import { Capacitor, registerPlugin } from '@capacitor/core';

export const isAndroidTracking = () => Capacitor.getPlatform() === 'android';
export const DriverLocation = registerPlugin<{
  start(options: { endpoint: string; token: string }): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<{ running: boolean; error?: string; lat?: number; lng?: number; capturedAt?: number }>;
}>('DriverLocation');

export async function stopDriverLocation() {
  if (isAndroidTracking()) await DriverLocation.stop();
}
