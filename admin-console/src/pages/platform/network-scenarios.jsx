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
import { networkScenarioRows } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformNetworkScenariosPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Scenarios"
          title="标准场景模板"
          description="固定展示第二批主演示链路和样板场景，用于平台、货站和 PDA 三端对齐。"
          chips={['Scenario B', 'Scenario A', 'Evidence Chain']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network" variant="outlined">
                返回网络总览
              </Button>
              <Button component={RouterLink} to="/platform/rules" variant="outlined">
                规则与指令引擎
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="标准场景">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>场景</TableCell>
                <TableCell>链路</TableCell>
                <TableCell>节点</TableCell>
                <TableCell>进入规则</TableCell>
                <TableCell>关键证据</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {networkScenarioRows.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.lane}</TableCell>
                  <TableCell>{item.nodes}</TableCell>
                  <TableCell>{item.entryRule}</TableCell>
                  <TableCell>{item.evidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
