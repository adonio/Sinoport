import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';

// project imports
import useAuth from 'hooks/useAuth';

// assets
import Google from 'assets/images/icons/google.svg';
import Twitter from 'assets/images/icons/twitter.svg';
import Facebook from 'assets/images/icons/facebook.svg';

// ==============================|| FIREBASE - SOCIAL BUTTON ||============================== //

export default function FirebaseSocial() {
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // @ts-ignore
  const { firebaseFacebookSignIn, firebaseGoogleSignIn, firebaseTwitterSignIn } = useAuth();
  const googleHandler = async () => {
    try {
      await firebaseGoogleSignIn();
    } catch (err) {
      console.error(err);
    }
  };

  const twitterHandler = async () => {
    try {
      await firebaseTwitterSignIn();
    } catch (err) {
      console.error(err);
    }
  };

  const facebookHandler = async () => {
    try {
      await firebaseFacebookSignIn();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Stack
      direction="row"
      sx={{ gap: { xs: 1, sm: 2 }, justifyContent: { xs: 'space-around', sm: 'space-between' }, '& .MuiButton-startIcon': { mr: 0 } }}
    >
      <Button
        variant="outlined"
        color="secondary"
        fullWidth={!downSM}
        startIcon={<CardMedia component="img" src={Google} alt="Google" />}
        onClick={googleHandler}
      ></Button>
      <Button
        variant="outlined"
        color="secondary"
        fullWidth={!downSM}
        startIcon={<CardMedia component="img" src={Twitter} alt="Twitter" />}
        onClick={twitterHandler}
      ></Button>
      <Button
        variant="outlined"
        color="secondary"
        fullWidth={!downSM}
        startIcon={<CardMedia component="img" src={Facebook} alt="Facebook" />}
        onClick={facebookHandler}
      ></Button>
    </Stack>
  );
}
