// material-ui
import Grid from '@mui/material/Grid';

// project imports
import ContainerWrapper from 'components/ContainerWrapper';
import ContactForm from 'sections/contact-us/ContactForm';
import ContactHeader from 'sections/contact-us/ContactHeader';

// ==============================|| CONTACT US - MAIN ||============================== //

export default function ContactUS() {
  return (
    <Grid container spacing={12} sx={{ mb: 12, justifyContent: 'center', alignItems: 'center' }}>
      <Grid size={12}>
        <ContactHeader />
      </Grid>
      <Grid size={{ xs: 12, sm: 10, lg: 9 }}>
        <ContainerWrapper>
          <ContactForm />
        </ContainerWrapper>
      </Grid>
    </Grid>
  );
}
