import Constants from 'expo-constants';

function getExpoHostUri() {
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const hostUri =
    process.env.EXPO_PUBLIC_API_URL ??
    expoConfig?.hostUri ??
    ((Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri ??
      null);

  if (!hostUri || hostUri.startsWith('http')) {
    return hostUri;
  }

  return `http://${hostUri.split(':')[0]}:4000`;
}

export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? getExpoHostUri() ?? 'http://10.0.2.2:4000',
};
