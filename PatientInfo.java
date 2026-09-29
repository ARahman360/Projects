import java.awt.EventQueue;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.JLabel;
import javax.swing.JOptionPane;

import java.awt.Font;
import javax.swing.JSeparator;
import javax.swing.JButton;
import javax.swing.SwingConstants;
import javax.swing.UIManager;
import javax.swing.JTextField;

import components.SidebarPanel;
import components.HeaderPanel;
import components.Kin;
import components.Patient;
import components.BodyPanel;
import components.CustomDate;

import java.awt.Color;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JCheckBox;

public class PatientInfo extends JFrame {
	private String selectedProblem;
	private static final long serialVersionUID = 1L;
	private JPanel contentPane;
	
	private JTextField textFirstName;
	private JTextField textSurName;
	private JTextField textDobYear;
	private JTextField textMobile;
	private JTextField textEmail;
	private JTextField textAddress;
	
	private JTextField textKinFirstName;
	private JTextField textKinSurName;
	private JTextField textKinRelation;
	private JTextField textKinMobile;
	private JTextField textKinEmail;
	private JTextField textKinAddress;
	private JTextField textDobDay;
	private JTextField textDobMonth;

	public PatientInfo(String selectedProblem) {
		this.selectedProblem = selectedProblem;
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 816, 465);
		contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));

		setContentPane(contentPane);
		contentPane.setLayout(null);
		
		// Header Panel
		HeaderPanel headerPanel = new HeaderPanel("Patient Info");
		contentPane.add(headerPanel);
		
		// Side bar Panel
		SidebarPanel sidebarPanel = new SidebarPanel();
		contentPane.add(sidebarPanel);
		
		// Body Panel
		BodyPanel bodyPanel = new BodyPanel();
		contentPane.add(bodyPanel);
		
		JButton gotoBookingButton = new JButton("Next");
		gotoBookingButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				CustomDate customDate = new CustomDate(textDobDay.getText(),textDobMonth.getText(),textDobYear.getText());
				if(customDate.isEmpty()) {
					JOptionPane.showMessageDialog(PatientInfo.this, "Date field cannot be empty!");
				} else if(customDate.isParsable()) {					
					Patient patient = new Patient(textFirstName.getText(), textSurName.getText(), customDate.getString(), textMobile.getText(), textEmail.getText(), textAddress.getText());
					Kin kin = new Kin(textKinFirstName.getText(), textKinSurName.getText(), textKinRelation.getText(), textKinMobile.getText(), textKinEmail.getText(), textKinAddress.getText());
					if(patient.noError() && kin.noError()) {
						dispose();
						BookingConfirmation bookingConfirmation = new BookingConfirmation(selectedProblem, patient, kin);
						bookingConfirmation.setVisible(true);
					} else {					
						JOptionPane.showMessageDialog(PatientInfo.this, "All fields are required!");
					}
				} else {
					JOptionPane.showMessageDialog(PatientInfo.this, "Invalid date provided!");
				}
			}
		});
		gotoBookingButton.setBounds(523, 330, 85, 31);
		bodyPanel.add(gotoBookingButton);
		gotoBookingButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		
		JLabel lblNewLabel_1_1 = new JLabel("First name");
		lblNewLabel_1_1.setBounds(10, 47, 141, 27);
		bodyPanel.add(lblNewLabel_1_1);
		lblNewLabel_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		JLabel lblNewLabel_1_2 = new JLabel("Surname");
		lblNewLabel_1_2.setBounds(155, 47, 141, 27);
		bodyPanel.add(lblNewLabel_1_2);
		lblNewLabel_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		textFirstName = new JTextField();
		textFirstName.setBounds(10, 69, 135, 30);
		bodyPanel.add(textFirstName);
		textFirstName.setColumns(10);
		
		textSurName = new JTextField();
		textSurName.setBounds(152, 69, 135, 30);
		bodyPanel.add(textSurName);
		textSurName.setColumns(10);
		
		JLabel lblNewLabel_1_1_1 = new JLabel("Date of birth");
		lblNewLabel_1_1_1.setBounds(12, 99, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_1);
		lblNewLabel_1_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		textDobDay = new JTextField();
		textDobDay.setHorizontalAlignment(SwingConstants.CENTER);
		textDobDay.setColumns(10);
		textDobDay.setBounds(10, 122, 35, 30);
		bodyPanel.add(textDobDay);
		
		textDobMonth = new JTextField();
		textDobMonth.setHorizontalAlignment(SwingConstants.CENTER);
		textDobMonth.setColumns(10);
		textDobMonth.setBounds(45, 122, 35, 30);
		bodyPanel.add(textDobMonth);
		
		textDobYear = new JTextField();
		textDobYear.setHorizontalAlignment(SwingConstants.CENTER);
		textDobYear.setBounds(80, 122, 70, 30);
		bodyPanel.add(textDobYear);
		textDobYear.setColumns(10);
		
		JLabel lblNewLabel_1_1_2 = new JLabel("Mobile number ");
		lblNewLabel_1_1_2.setBounds(155, 99, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_2);
		lblNewLabel_1_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		textMobile = new JTextField();
		textMobile.setBounds(155, 121, 132, 30);
		bodyPanel.add(textMobile);
		textMobile.setColumns(10);
		
		JLabel lblNewLabel_1_1_2_1 = new JLabel("Email");
		lblNewLabel_1_1_2_1.setBounds(10, 158, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_2_1);
		lblNewLabel_1_1_2_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		textEmail = new JTextField();
		textEmail.setBounds(10, 183, 277, 30);
		bodyPanel.add(textEmail);
		textEmail.setColumns(10);
		
		JLabel lblNewLabel_1_1_2_1_1 = new JLabel("Address");
		lblNewLabel_1_1_2_1_1.setBounds(10, 211, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_2_1_1);
		lblNewLabel_1_1_2_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		textAddress = new JTextField();
		textAddress.setBounds(10, 234, 277, 52);
		bodyPanel.add(textAddress);
		textAddress.setColumns(10);
		
		JButton goBackButton = new JButton("Back");
		goBackButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		goBackButton.setBounds(10, 330, 85, 31);
		bodyPanel.add(goBackButton);
		goBackButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		
		JLabel lblPatientInformation = new JLabel("Patient Information");
		lblPatientInformation.setFont(new Font("Tahoma", Font.BOLD, 16));
		lblPatientInformation.setBounds(10, 11, 294, 25);
		bodyPanel.add(lblPatientInformation);
		
		JLabel lblKinsInformation = new JLabel("Kin's Information");
		lblKinsInformation.setFont(new Font("Tahoma", Font.BOLD, 16));
		lblKinsInformation.setBounds(314, 11, 294, 25);
		bodyPanel.add(lblKinsInformation);
		
		JSeparator separator = new JSeparator();
		separator.setOrientation(SwingConstants.VERTICAL);
		separator.setBounds(300, 0, 1, 315);
		bodyPanel.add(separator);
		
		textKinRelation = new JTextField();
		textKinRelation.setColumns(10);
		textKinRelation.setBounds(311, 122, 140, 30);
		bodyPanel.add(textKinRelation);
		
		JLabel lblNewLabel_1_1_1_1 = new JLabel("Relation");
		lblNewLabel_1_1_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_1_1.setBounds(313, 99, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_1_1);
		
		textKinFirstName = new JTextField();
		textKinFirstName.setColumns(10);
		textKinFirstName.setBounds(311, 69, 135, 30);
		bodyPanel.add(textKinFirstName);
		
		textKinSurName = new JTextField();
		textKinSurName.setColumns(10);
		textKinSurName.setBounds(456, 69, 135, 30);
		bodyPanel.add(textKinSurName);
		
		JLabel lblNewLabel_1_2_1 = new JLabel("Surname");
		lblNewLabel_1_2_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_2_1.setBounds(456, 47, 141, 27);
		bodyPanel.add(lblNewLabel_1_2_1);
		
		JLabel lblNewLabel_1_1_3 = new JLabel("First name");
		lblNewLabel_1_1_3.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_3.setBounds(311, 47, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_3);
		
		JSeparator separator_1 = new JSeparator();
		separator_1.setBounds(0, 316, 615, 4);
		bodyPanel.add(separator_1);
		
		JLabel lblPatientsProblem = new JLabel("Patient's Problem:");
		lblPatientsProblem.setForeground(Color.DARK_GRAY);
		lblPatientsProblem.setFont(new Font("Tahoma", Font.BOLD, 13));
		lblPatientsProblem.setBounds(105, 328, 403, 20);
		bodyPanel.add(lblPatientsProblem);
		
		JLabel problemDetailsText = new JLabel("Problem Details");
		problemDetailsText.setFont(new Font("Tahoma", Font.PLAIN, 14));
		problemDetailsText.setBounds(105, 345, 408, 20);
		problemDetailsText.setText(selectedProblem);
		bodyPanel.add(problemDetailsText);
		
		textKinAddress = new JTextField();
		textKinAddress.setColumns(10);
		textKinAddress.setBounds(313, 234, 277, 52);
		bodyPanel.add(textKinAddress);
		
		JLabel lblNewLabel_1_1_2_1_1_1 = new JLabel("Address");
		lblNewLabel_1_1_2_1_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2_1_1_1.setBounds(313, 211, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_2_1_1_1);
		
		textKinEmail = new JTextField();
		textKinEmail.setColumns(10);
		textKinEmail.setBounds(313, 183, 277, 30);
		bodyPanel.add(textKinEmail);
		
		JLabel lblNewLabel_1_1_2_1_2 = new JLabel("Email");
		lblNewLabel_1_1_2_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2_1_2.setBounds(313, 158, 141, 27);
		bodyPanel.add(lblNewLabel_1_1_2_1_2);
		
		textKinMobile = new JTextField();
		textKinMobile.setColumns(10);
		textKinMobile.setBounds(458, 121, 132, 30);
		bodyPanel.add(textKinMobile);
		
		JLabel lblNewLabel_1_1_2_2 = new JLabel("Mobile number ");
		lblNewLabel_1_1_2_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2_2.setBounds(458, 99, 135, 27);
		bodyPanel.add(lblNewLabel_1_1_2_2);
		
		JCheckBox chckbxNewCheckBox = new JCheckBox("Any disablities? Check if yes.");
		chckbxNewCheckBox.setBounds(12, 292, 275, 23);
		bodyPanel.add(chckbxNewCheckBox);
	}
	
	public void setPatientInfo(Patient patientInfo, Kin kinInfo) {
		String[] dateParts = patientInfo.dob.split("-");	
		textDobDay.setText(dateParts[0]);
		textDobMonth.setText(dateParts[1]);
		textDobYear.setText(dateParts[2]);
		
		textFirstName.setText(patientInfo.firstName);
		textSurName.setText(patientInfo.surName);
		textMobile.setText(patientInfo.mobile);
		textEmail.setText(patientInfo.email);
		textAddress.setText(patientInfo.address);
		
		textKinFirstName.setText(kinInfo.firstName);
		textKinSurName.setText(kinInfo.surName);
		textKinRelation.setText(kinInfo.relation);
		textKinMobile.setText(kinInfo.mobile);
		textKinEmail.setText(kinInfo.email);
		textKinAddress.setText(kinInfo.address);
	}
	
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					PatientInfo frame = new PatientInfo("Example Problem");
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}
}
