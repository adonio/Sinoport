import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { platformStationCapabilityRows } from 'data/sinoport-adapters';

export default function PlatformStationsCapabilitiesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Capability Matrix"
          title="货站能力矩阵"
          description="以站点能力、SLA、控制深度和当前风险为主视角展示平台侧的货站能力矩阵。"
          chips={['Capabilities', 'SLA', 'Control Level', 'Readiness']}
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="站点能力矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>区域</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>能力</TableCell>
                <TableCell>当前风险</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationCapabilityRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.region}</TableCell>
                  <TableCell><StatusChip label={item.control} /></TableCell>
                  <TableCell><StatusChip label={item.phase} /></TableCell>
                  <TableCell>{item.promise}</TableCell>
                  <TableCell>{item.capabilities}</TableCell>
                  <TableCell>{item.risk}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
