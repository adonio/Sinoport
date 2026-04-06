import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights, outboundFlights, stationDashboardKpis, transferRecords } from 'data/sinoport';

export default function StationDashboardPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Admin"
          title="货站后台总览"
          description="货站首页优先展示今天的航班、阻塞节点、NOA/POD 队列和二次转运任务，而不是传统 ERP 菜单。"
          chips={['Inbound', 'Outbound', 'NOA', 'POD', 'Transfer']}
        />
      </Grid>

      {stationDashboardKpis.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="今日进港航班">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETA</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>优先级</TableCell>
                <TableCell>货量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>{item.step}</TableCell>
                  <TableCell>{item.priority}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="今日出港航班">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETD</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell>货量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.manifest}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="二次转运待办">
          <List disablePadding>
            {transferRecords.map((item) => (
              <ListItem key={item.transferId} divider>
                <ListItemText primary={`${item.transferId} · ${item.awb}`} secondary={`${item.destination} · ${item.plate} · ${item.driver} · ${item.departAt}`} />
              </ListItem>
            ))}
          </List>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="站内执行原则">
          <Stack sx={{ gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              1. 未完成理货不得发送 NOA。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              2. 二次转运必须记录车牌、司机、出发时间与交接文件。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. 出港未完成主单与装载信息不得标记飞走。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4. POD 未双签不得关闭交付。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
