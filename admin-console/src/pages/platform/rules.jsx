import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
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

import DownOutlined from '@ant-design/icons/DownOutlined';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { exceptionTaxonomy, hardGateRules, interfaceStatus, serviceLevels } from 'data/sinoport';

export default function PlatformRulesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Rules Center"
          title="规则中心"
          description="规则中心统一维护服务等级、硬门槛、异常归因和接口治理口径，确保平台与货站后台遵循同一状态机逻辑。"
          chips={['P1/P2/P3', 'Hard Gates', 'Exception Dictionary', 'Interface Policy']}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="服务等级">
          <List disablePadding>
            {serviceLevels.map((item) => (
              <ListItem key={item.level} divider>
                <ListItemText primary={`${item.level} · ${item.summary}`} secondary={item.rules} />
              </ListItem>
            ))}
          </List>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="硬门槛规则">
          <Stack sx={{ gap: 1.5 }}>
            {hardGateRules.map((rule) => (
              <Accordion key={rule} disableGutters>
                <AccordionSummary expandIcon={<DownOutlined />}>
                  <Typography variant="subtitle2">{rule}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary">
                    该规则来自 PRD 的节点状态机要求，用于阻断不满足条件的状态流转并留下审计痕迹。
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="异常字典">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>异常类型</TableCell>
                <TableCell>责任 Owner</TableCell>
                <TableCell>目标时限</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptionTaxonomy.map((item) => (
                <TableRow key={item.type} hover>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="接口治理">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>接口</TableCell>
                <TableCell>方式</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>最近同步</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interfaceStatus.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.method}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.sync}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
