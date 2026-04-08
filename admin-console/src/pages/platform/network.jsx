import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { routeMatrix, stationCatalog } from 'data/sinoport';

export default function PlatformNetworkPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Route Governance"
          title="航线网络与链路配置"
          description="平台侧按链路维护货站协作关系、承诺时效、关键事件覆盖和节点边界，避免只做站点台账而没有链路控制。"
          chips={['Lane Matrix', 'Coverage', 'Station Collaboration', 'Node Configuration']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network/lanes" variant="outlined">
                链路模板
              </Button>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                场景模板
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="主链路矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>链路</TableCell>
                <TableCell>业务模式</TableCell>
                <TableCell>站点协作</TableCell>
                <TableCell>承诺口径</TableCell>
                <TableCell>关键事件</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routeMatrix.map((item) => (
                <TableRow key={item.lane} hover>
                  <TableCell>{item.lane}</TableCell>
                  <TableCell>{item.pattern}</TableCell>
                  <TableCell>{item.stations}</TableCell>
                  <TableCell>{item.promise}</TableCell>
                  <TableCell>{item.events}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="网络准备度">
          <Stack sx={{ gap: 2.5 }}>
            {stationCatalog.map((station, index) => (
              <Stack key={station.code} sx={{ gap: 0.75 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">{station.code}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {80 + ((index * 3) % 18)}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={80 + ((index * 3) % 18)} />
                <Typography variant="caption" color="text.secondary">
                  {station.scope}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
