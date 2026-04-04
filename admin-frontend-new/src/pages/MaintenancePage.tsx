import { useState, useEffect } from 'react';
import { useDataProvider, Title } from 'react-admin';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material';
import type { PhiloDataProvider } from '../dataProvider';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface SeedVersion {
  _id: string;
  version: string;
  description: string;
  appliedAt: string;
}

interface LLMLogStats {
  count: number;
  estimatedSizeBytes: number;
}

export default function MaintenancePage() {
  const dataProvider = useDataProvider() as PhiloDataProvider;
  const [versions, setVersions] = useState<SeedVersion[]>([]);
  const [stats, setStats] = useState<LLMLogStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vResult, sResult] = await Promise.all([
          dataProvider.getSeedVersions(),
          dataProvider.getLLMLogStats(),
        ]);
        if (!cancelled) {
          setVersions(vResult.data as SeedVersion[]);
          setStats(sResult.data as unknown as LLMLogStats);
        }
      } catch (err) {
        console.error('Failed to load maintenance data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataProvider]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Title title="Maintenance" />

      {/* Seed Versions */}
      <Card>
        <CardHeader title="Seed Versions" />
        <CardContent>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No seed versions recorded yet.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Version</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Applied At</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((v, i) => (
                    <TableRow key={v._id || v.version}>
                      <TableCell><strong>{v.version}</strong></TableCell>
                      <TableCell>{v.description}</TableCell>
                      <TableCell>{new Date(v.appliedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={i === versions.length - 1 ? 'Latest' : 'Applied'}
                          color={i === versions.length - 1 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* LLM Log Storage */}
      <Card>
        <CardHeader title="LLM Log Storage" />
        <CardContent>
          {stats ? (
            <Box>
              <Typography variant="h6">
                {stats.count.toLocaleString()} log documents — ~{formatBytes(stats.estimatedSizeBytes)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                TTL auto-expiry is configured via <code>LLM_LOG_TTL_DAYS</code> environment variable.
                Logs without an expiry date will persist until manually deleted.
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Unable to fetch LLM log stats.</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
