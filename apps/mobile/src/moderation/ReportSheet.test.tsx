import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReportSheet } from './ReportSheet';
import { useReport } from './hooks';

jest.mock('./hooks');
const reportFn = jest.fn().mockResolvedValue({});
(useReport as jest.Mock).mockReturnValue({ report: reportFn, sending: false });

it('envoie le signalement avec la raison choisie', async () => {
  const onClose = jest.fn();
  render(<ReportSheet visible targetType="DESIGN" targetId="d1" onClose={onClose} />);
  fireEvent.press(screen.getByText('Spam'));
  await waitFor(() =>
    expect(reportFn).toHaveBeenCalledWith({ targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' }),
  );
});
