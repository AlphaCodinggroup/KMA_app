import React, { type PropsWithChildren, useEffect, useState } from 'react'
// import { useRouter } from 'expo-router';
// import { readSession } from '@shared/session/session';

export function AuthGuard({ children }: PropsWithChildren) {
  // const router = useRouter();
  const [ready, setReady] = useState(true)
  // const [hasSession, setHasSession] = useState<boolean>(false);

  useEffect(() => {
    // (LOGIN DESACTIVADO)
    // (1) Rehidratación de sesión real:
    // readSession().then((session) => {
    //   setHasSession(!!session?.accessToken);
    //   setReady(true);
    // });

    setReady(true)
  }, [])

  // useEffect(() => {
  //   if (ready && !hasSession) {
  //     router.replace('/(auth)/login'); // Guard real
  //   }
  // }, [ready, hasSession, router]);

  if (!ready) return null
  return <>{children}</>
}
