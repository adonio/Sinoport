import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetPlatformNetwork } from 'api/platform';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformNetworkLanesPage() {
  const { networkLaneTemplateRows } = useGetPlatformNetwork();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Lane Templates"
          title="链路模板"
          description="查看第二批主演示链路及其节点顺序、SLA 和控制深度。"
          chips={['Lane Template', 'Node Order', 'SLA']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network" variant="outlined">
                返回网络总览
              </Button>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                标准场景
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="链路模板表">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>模板编号</TableCell>
                <TableCell>链路</TableCell>
                <TableCell>节点顺序</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>控制深度</TableCell>
                <TableCell>样板站点</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {networkLaneTemplateRows.map((item) => (
                <TableRow key={item.laneCode} hover>
                  <TableCell>{item.laneCode}</TableCell>
                  <TableCell>{item.lane}</TableCell>
                  <TableCell>{item.nodeOrder}</TableCell>
                  <TableCell>{item.sla}</TableCell>
                  <TableCell>{item.controlDepth}</TableCell>
                  <TableCell>{item.sampleStation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
