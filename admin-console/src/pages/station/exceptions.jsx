import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { exceptionCases, exceptionOverview } from 'data/sinoport';

export default function StationExceptionsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Exception Center"
          title="异常中心"
          description="所有数量、单证、转运和签收问题都必须结构化记录，不允许只保留聊天截图或口头结论。"
          chips={['Structured Classification', 'Ownership', 'SLA Closure']}
        />
      </Grid>

      {exceptionOverview.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="异常案例">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>异常编号</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>责任 Owner</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptionCases.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.sla}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
