import { Card, CardContent, CardHeader, Box } from '@mui/material';
import { useGetList, useGetIdentity } from 'react-admin';
import PeopleIcon from '@mui/icons-material/People';
import LockIcon from '@mui/icons-material/Lock';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card sx={{ minWidth: 200, flex: 1 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color: 'primary.main', fontSize: 40, display: 'flex' }}>{icon}</Box>
        <Box>
          <Box sx={{ fontSize: 28, fontWeight: 'bold' }}>{value}</Box>
          <Box sx={{ color: 'text.secondary' }}>{title}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { identity } = useGetIdentity();
  const { total: userCount } = useGetList('users', { pagination: { page: 1, perPage: 1 }, sort: { field: 'id', order: 'ASC' }, filter: {} });
  const { data: allUsers } = useGetList('users', { pagination: { page: 1, perPage: 10000 }, sort: { field: 'id', order: 'ASC' }, filter: {} });
  const { total: botCount } = useGetList('bots', { pagination: { page: 1, perPage: 1 }, sort: { field: 'id', order: 'ASC' }, filter: {} });
  const { total: sessionCount } = useGetList('sessions', { pagination: { page: 1, perPage: 1 }, sort: { field: 'id', order: 'ASC' }, filter: {} });

  const lockedCount = allUsers?.filter((u) => u.isLocked).length ?? 0;

  return (
    <Box sx={{ mt: 2 }}>
      <Card sx={{ mb: 3 }}>
        <CardHeader title={`Welcome${identity?.fullName ? `, ${identity.fullName}` : ''}`} />
        <CardContent>PhiloGPT Administration Panel</CardContent>
      </Card>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <StatCard title="Total Users" value={userCount ?? '…'} icon={<PeopleIcon fontSize="inherit" />} />
        <StatCard title="Locked Users" value={lockedCount} icon={<LockIcon fontSize="inherit" />} />
        <StatCard title="Bots" value={botCount ?? '…'} icon={<SmartToyIcon fontSize="inherit" />} />
        <StatCard title="Sessions" value={sessionCount ?? '…'} icon={<ChatIcon fontSize="inherit" />} />
      </Box>
    </Box>
  );
}
