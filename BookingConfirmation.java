import java.awt.EventQueue;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;

import components.BodyPanel;
import components.CustomDateParser;
import components.DBConn;
import components.HeaderPanel;
import components.Kin;
import components.Patient;
import components.SidebarPanel;

import javax.swing.JLabel;
import javax.swing.JOptionPane;

import java.awt.Font;
import javax.swing.JSeparator;
import javax.swing.JButton;
import javax.swing.SwingConstants;
import javax.swing.UIManager;
import javax.swing.JTextField;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import java.awt.Color;
import java.awt.SystemColor;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Random;

public class BookingConfirmation extends JFrame {
	Connection connection = null;
	private static final long serialVersionUID = 1L;
	private int visitingNumber;

	public BookingConfirmation(String selectedProblem, Patient patientInfo, Kin kinInfo) {
		connection = DBConn.dbConnector();
		Random rnd = new Random();
		visitingNumber = 10000000 + rnd.nextInt(90000000);
		
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 812, 463);
		JPanel contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));

		setContentPane(contentPane);
		contentPane.setLayout(null);
		
		// Header Panel
		HeaderPanel headerPanel = new HeaderPanel("Booking Confirmation");
		contentPane.add(headerPanel);

		// Side bar Panel
		SidebarPanel sidebarPanel = new SidebarPanel();
		contentPane.add(sidebarPanel);

		// Body Panel
		BodyPanel bodyPanel = new BodyPanel();
		contentPane.add(bodyPanel);
		
		
		JButton goBackButton = new JButton("Back");
		goBackButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				PatientInfo patientInfos = new PatientInfo(selectedProblem);
				patientInfos.setPatientInfo(patientInfo, kinInfo);
				patientInfos.setVisible(true);
			}
		});
		goBackButton.setBounds(10, 333, 85, 31);
		bodyPanel.add(goBackButton);
		goBackButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		
		JButton mainMenuButton = new JButton("Main Menu");
		mainMenuButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		mainMenuButton.setBounds(500, 333, 100, 31);
		bodyPanel.add(mainMenuButton);
		mainMenuButton.setFont(new Font("Tahoma", Font.PLAIN, 12));

		JButton btnConfirm = new JButton("Confirm");
		btnConfirm.setBounds(161, 43, 290, 35);
		btnConfirm.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				PreparedStatement pstmt = null;
				String queryString = "INSERT INTO patients(visitingNumber,problem,firstName,surName,dob,mobile,email,address,kFirstName,kSurName,kRelation,kMobile,kEmail,kAddress) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
			    try {
			        pstmt = connection.prepareStatement(queryString);
					pstmt.setInt(1, visitingNumber);
            		pstmt.setString(2, selectedProblem);
            		pstmt.setString(3, patientInfo.firstName);
            		pstmt.setString(4, patientInfo.surName);
            		pstmt.setString(5, patientInfo.dob);
            		pstmt.setString(6, patientInfo.mobile);
            		pstmt.setString(7, patientInfo.email);
            		pstmt.setString(8, patientInfo.address);
            		pstmt.setString(9, kinInfo.firstName);
            		pstmt.setString(10, kinInfo.surName);
            		pstmt.setString(11, kinInfo.relation);
            		pstmt.setString(12, kinInfo.mobile);
            		pstmt.setString(13, kinInfo.email);
            		pstmt.setString(14, kinInfo.address);
					pstmt.executeUpdate();
			    } catch(Exception ex) {
					JOptionPane.showMessageDialog(null, ex);
				} finally {
					try {
						pstmt.close();
						connection.close();
						JOptionPane.showMessageDialog(BookingConfirmation.this, "Booking Confirmed!");
						dispose();
						MedicalAilments medicalAilments = new MedicalAilments();
						medicalAilments.setVisible(true);
					} catch (SQLException e1) {
						e1.printStackTrace();
					}
        		}
			}
		});
		bodyPanel.add(btnConfirm);
		
		JButton btnLater = new JButton("Later");
		btnLater.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				JOptionPane.showMessageDialog(BookingConfirmation.this, "See you later! Thanks for visiting BMH");
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		btnLater.setBounds(161, 88, 290, 35);
		btnLater.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
			}
		});
		bodyPanel.add(btnLater);
		btnLater.setBackground(new Color(255, 255, 255));
		
		JLabel lblNewLabel_1 = new JLabel("Confirm booking?");
		lblNewLabel_1.setBounds(248, 11, 118, 27);
		bodyPanel.add(lblNewLabel_1);
		lblNewLabel_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		
		JSeparator separator_2 = new JSeparator();
		separator_2.setBounds(0, 134, 615, 2);
		bodyPanel.add(separator_2);
		
		JLabel lblNewLabel_1_1 = new JLabel("Your visit number:");
		lblNewLabel_1_1.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel_1_1.setBounds(5, 223, 595, 27);
		bodyPanel.add(lblNewLabel_1_1);
		lblNewLabel_1_1.setFont(new Font("Tahoma", Font.PLAIN, 16));
		
		JLabel randomNumberText = new JLabel(String.valueOf(visitingNumber));
		randomNumberText.setBounds(226, 257, 153, 27);
		randomNumberText.setHorizontalAlignment(SwingConstants.CENTER);
		randomNumberText.setFont(new Font("Arial", Font.BOLD, 30));
		bodyPanel.add(randomNumberText);

		JLabel lblNewLabel_1_2 = new JLabel("Remember your visit number for later use.");
		lblNewLabel_1_2.setForeground(Color.MAGENTA);
		lblNewLabel_1_2.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel_1_2.setFont(new Font("Tahoma", Font.PLAIN, 12));
		lblNewLabel_1_2.setBounds(10, 282, 595, 27);
		bodyPanel.add(lblNewLabel_1_2);
		
		JSeparator separator_2_1 = new JSeparator();
		separator_2_1.setBounds(0, 320, 615, 2);
		bodyPanel.add(separator_2_1);
		
		JSeparator separator_2_2 = new JSeparator();
		separator_2_2.setBounds(0, 197, 615, 2);
		bodyPanel.add(separator_2_2);
		
		JLabel processedText = new JLabel("");
		CustomDateParser ageData = new CustomDateParser(patientInfo.dob);
		processedText.setText(ageData.getBenifitMessage());
		processedText.setHorizontalAlignment(SwingConstants.CENTER);
		processedText.setForeground(Color.BLUE);
		processedText.setFont(new Font("Tahoma", Font.BOLD, 12));
		processedText.setBounds(5, 159, 595, 27);
		bodyPanel.add(processedText);
		
		JLabel lblNewLabel_1_3 = new JLabel("NOTE:");
		lblNewLabel_1_3.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel_1_3.setFont(new Font("Tahoma", Font.BOLD, 15));
		lblNewLabel_1_3.setBounds(237, 141, 118, 27);
		bodyPanel.add(lblNewLabel_1_3);
	}
	
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					Patient patient = new Patient("","","","","","");
					Kin kin = new Kin("","","","","","");
					BookingConfirmation frame = new BookingConfirmation("", patient, kin);
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}
}
