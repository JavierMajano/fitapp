import { Tabs } from 'expo-router';
import { View } from 'react-native';

function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  color: string;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <View
      className={`h-10 w-10 items-center justify-center rounded-xl ${focused ? 'bg-brand-400/20' : ''}`}
    >
      {children}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#2e2e2e',
          borderTopWidth: 0.5,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#1a9e6e',
        tabBarInactiveTintColor: '#52525b',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} size={24}>
              <DashIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} size={24}>
              <FoodIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} size={24}>
              <WorkoutIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} size={24}>
              <ProgressIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} size={24}>
              <ProfileIcon color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

// Inline SVG-style icons using View shapes
function DashIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, gap: 3, flexDirection: 'row' }}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flex: 1.2, backgroundColor: color, borderRadius: 3 }} />
        <View style={{ flex: 0.8, backgroundColor: color, borderRadius: 3 }} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flex: 0.8, backgroundColor: color, borderRadius: 3 }} />
        <View style={{ flex: 1.2, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function FoodIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: 2,
          height: 7,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

function WorkoutIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 14, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View
        style={{ width: 5, height: 14, borderRadius: 2.5, borderWidth: 2, borderColor: color }}
      />
      <View style={{ flex: 1, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 8, height: 8, borderRadius: 2, borderWidth: 2, borderColor: color }} />
      <View style={{ flex: 1, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{ width: 5, height: 14, borderRadius: 2.5, borderWidth: 2, borderColor: color }}
      />
    </View>
  );
}

function ProgressIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      <View style={{ flex: 1, height: 8, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ flex: 1, height: 13, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ flex: 1, height: 10, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ flex: 1, height: 18, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center' }}>
      <View
        style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: color }}
      />
      <View
        style={{
          width: 16,
          height: 7,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderWidth: 2,
          borderColor: color,
          marginTop: 1,
          borderBottomWidth: 0,
        }}
      />
    </View>
  );
}
