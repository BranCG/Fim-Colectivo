'use client';

import { useFcmToken } from '@/lib/useFcmToken';

export default function FcmInitializer() {
  useFcmToken();
  return null;
}
