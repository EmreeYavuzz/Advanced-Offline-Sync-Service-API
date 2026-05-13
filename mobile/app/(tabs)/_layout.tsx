import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import { ServerConnectionBadge } from '@/src/components/ServerConnectionBadge';
import { theme } from '@/src/constants/theme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={20} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: {
          color: theme.text,
          fontWeight: '800',
        },
        headerStyle: {
          backgroundColor: theme.bg,
        },
        headerRight: () => <ServerConnectionBadge />,
        headerShadowVisible: false,
        sceneStyle: {
          backgroundColor: theme.bg,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Yeni Talep',
          tabBarLabel: 'Talep',
          tabBarIcon: ({ color }) => <TabBarIcon name="plus-square" color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Tüm Kayıtlar',
          tabBarLabel: 'Kayıtlar',
          tabBarIcon: ({ color }) => <TabBarIcon name="list-alt" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'İşlem Geçmişi',
          tabBarLabel: 'Geçmiş',
          tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
        }}
      />
    </Tabs>
  );
}
