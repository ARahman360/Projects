import java.awt.EventQueue;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;

import components.HeaderPanel;
import javax.swing.JTextField;
import javax.swing.JButton;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import javax.swing.JLabel;
import java.awt.Font;
import javax.swing.JSeparator;
import javax.swing.SwingConstants;
import javax.swing.UIManager;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.sql.ResultSet;
import java.sql.SQLException;

public class PatientDetails extends JFrame {

	private static final long serialVersionUID = 1L;
	private JPanel contentPane;
	private JLabel lblNewLabel_1;
	private JLabel lblNewLabel_1_1;
	private JLabel lblNewLabel_1_1_1;
	private JLabel lblNewLabel_1_1_2;
	private JLabel lblNewLabel_1_1_2_1;
	private JButton goBackButton;
	private JLabel firstNameText;
	private JLabel ageText;
	private JLabel mobileText;
	private JLabel emailText;
	private JLabel addressText;
	private JSeparator separator;
	private JLabel problemText;
	private JLabel selectedProblemText;
	private JLabel kinNameText;
	private JLabel kNameText;
	private JLabel lblNewLabel_1_2;
	private JLabel kRelationText;
	private JLabel lblNewLabel_1_1_3;
	private JLabel kMobileText;
	private JSeparator separator_1;
	private JLabel lblNewLabel_1_1_2_4;
	private JLabel visitNumberText;

	public PatientDetails(int visitingNumber,String problem,String firstName,String surName,String dob,String mobile,String email,String address,String kFirstName,String kSurName,String kRelation,String kMobile,String kEmail,String kAddress) {
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 816, 465);
		contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));

		setContentPane(contentPane);
		contentPane.setLayout(null);
		
		// Header Panel
		HeaderPanel headerPanel = new HeaderPanel("Patient Details");
		headerPanel.setBounds(0, 0, 800, 50);
		contentPane.add(headerPanel);
		
		lblNewLabel_1 = new JLabel("Patient name");
		lblNewLabel_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1.setBounds(26, 73, 141, 27);
		contentPane.add(lblNewLabel_1);
		
		lblNewLabel_1_1 = new JLabel("Patient age");
		lblNewLabel_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1.setBounds(26, 125, 141, 27);
		contentPane.add(lblNewLabel_1_1);
		
		lblNewLabel_1_1_1 = new JLabel("Mobile number ");
		lblNewLabel_1_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_1.setBounds(26, 177, 141, 27);
		contentPane.add(lblNewLabel_1_1_1);
		
		lblNewLabel_1_1_2 = new JLabel("Email");
		lblNewLabel_1_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2.setBounds(26, 229, 141, 27);
		contentPane.add(lblNewLabel_1_1_2);
		
		lblNewLabel_1_1_2_1 = new JLabel("Address");
		lblNewLabel_1_1_2_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2_1.setBounds(26, 281, 141, 27);
		contentPane.add(lblNewLabel_1_1_2_1);
		
		goBackButton = new JButton("Go back");
		goBackButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		goBackButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		goBackButton.setBounds(10, 369, 200, 35);
		contentPane.add(goBackButton);
		
		firstNameText = new JLabel("Abdur Rahman");
		firstNameText.setText(firstName + ' ' + surName);
		firstNameText.setFont(new Font("Tahoma", Font.BOLD, 16));
		firstNameText.setBounds(26, 99, 332, 27);
		contentPane.add(firstNameText);
		
		ageText = new JLabel("Abdur Rahman");
		ageText.setText(dob);
		ageText.setFont(new Font("Tahoma", Font.BOLD, 16));
		ageText.setBounds(26, 151, 332, 27);
		contentPane.add(ageText);
		
		mobileText = new JLabel("Abdur Rahman");
		mobileText.setText(mobile);
		mobileText.setFont(new Font("Tahoma", Font.BOLD, 16));
		mobileText.setBounds(26, 203, 332, 27);
		contentPane.add(mobileText);
		
		emailText = new JLabel("Abdur Rahman");
		emailText.setText(email);
		emailText.setFont(new Font("Tahoma", Font.BOLD, 16));
		emailText.setBounds(26, 255, 332, 27);
		contentPane.add(emailText);
		
		addressText = new JLabel("Abdur Rahman");
		addressText.setText(address);
		addressText.setFont(new Font("Tahoma", Font.BOLD, 16));
		addressText.setBounds(26, 307, 332, 27);
		contentPane.add(addressText);
		
		separator = new JSeparator();
		separator.setOrientation(SwingConstants.VERTICAL);
		separator.setBounds(368, 50, 2, 308);
		contentPane.add(separator);
		
		problemText = new JLabel("Medical problem");
		problemText.setFont(new Font("Tahoma", Font.PLAIN, 14));
		problemText.setBounds(380, 112, 141, 27);
		contentPane.add(problemText);
		
		selectedProblemText = new JLabel("Abdur Rahman");
		selectedProblemText.setText(problem);
		selectedProblemText.setFont(new Font("Tahoma", Font.BOLD, 16));
		selectedProblemText.setBounds(380, 138, 410, 27);
		contentPane.add(selectedProblemText);
		
		kinNameText = new JLabel("Kin's name");
		kinNameText.setFont(new Font("Tahoma", Font.PLAIN, 14));
		kinNameText.setBounds(380, 191, 141, 27);
		contentPane.add(kinNameText);
		
		kNameText = new JLabel("Abdur Rahman");
		kNameText.setText(kFirstName + ' ' + kSurName);
		kNameText.setFont(new Font("Tahoma", Font.BOLD, 16));
		kNameText.setBounds(380, 217, 410, 27);
		contentPane.add(kNameText);
		
		lblNewLabel_1_2 = new JLabel("Relation with patient");
		lblNewLabel_1_2.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_2.setBounds(380, 243, 141, 27);
		contentPane.add(lblNewLabel_1_2);
		
		kRelationText = new JLabel("Abdur Rahman");
		kRelationText.setText(kRelation);
		kRelationText.setFont(new Font("Tahoma", Font.BOLD, 16));
		kRelationText.setBounds(380, 269, 410, 27);
		contentPane.add(kRelationText);
		
		lblNewLabel_1_1_3 = new JLabel("Mobile number ");
		lblNewLabel_1_1_3.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_3.setBounds(380, 295, 141, 27);
		contentPane.add(lblNewLabel_1_1_3);
		
		kMobileText = new JLabel("Abdur Rahman");
		kMobileText.setText(kMobile);
		kMobileText.setFont(new Font("Tahoma", Font.BOLD, 16));
		kMobileText.setBounds(380, 321, 410, 27);
		contentPane.add(kMobileText);
		
		separator_1 = new JSeparator();
		separator_1.setBounds(0, 356, 800, 2);
		contentPane.add(separator_1);
		
		lblNewLabel_1_1_2_4 = new JLabel("Visit number");
		lblNewLabel_1_1_2_4.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1_2_4.setBounds(380, 61, 141, 27);
		contentPane.add(lblNewLabel_1_1_2_4);
		
		visitNumberText = new JLabel("88888888");
		visitNumberText.setText(String.valueOf(visitingNumber));
		visitNumberText.setFont(new Font("Tahoma", Font.BOLD, 16));
		visitNumberText.setBounds(380, 87, 410, 27);
		contentPane.add(visitNumberText);
		
		JSeparator separator_1_1 = new JSeparator();
		separator_1_1.setBounds(369, 176, 431, 2);
		contentPane.add(separator_1_1);
		
		JButton btnNewButton_7_1 = new JButton("Book Another Appointment");
		btnNewButton_7_1.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
			}
		});
		btnNewButton_7_1.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		btnNewButton_7_1.setFont(new Font("Tahoma", Font.PLAIN, 12));
		btnNewButton_7_1.setBounds(226, 369, 200, 35);
		contentPane.add(btnNewButton_7_1);
	}
	
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					PatientDetails frame = new PatientDetails(888,"","","","","","","","","","","","","");
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}
}
