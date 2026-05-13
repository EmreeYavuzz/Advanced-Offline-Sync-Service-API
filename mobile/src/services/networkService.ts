import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import type { NetworkSnapshot } from '@/src/types/sync';

export function toNetworkSnapshot(state: NetInfoState): NetworkSnapshot {
  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  };
}

export function canSyncWithNetwork(network: NetworkSnapshot) {
  return network.isConnected === true && network.isInternetReachable !== false;
}

export async function getCurrentNetworkSnapshot() {
  return toNetworkSnapshot(await NetInfo.fetch());
}

export function subscribeToNetworkChanges(listener: (snapshot: NetworkSnapshot) => void) {
  return NetInfo.addEventListener((state) => {
    listener(toNetworkSnapshot(state));
  });
}
