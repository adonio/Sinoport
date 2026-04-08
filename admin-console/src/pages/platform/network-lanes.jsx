import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { networkLaneTemplateRows } from 'data/sinoport-adapters';

export default function PlatformNetworkLanesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Lane Templates" title="链路模板" description="查看第二批主演示链路及其节点顺序、SLA 和控制深度。" chips={['Lane Template', 'Node Order', 'SLA']} />
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
