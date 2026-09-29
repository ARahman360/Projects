package components;

import java.awt.Color;

import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSeparator;
import javax.swing.SwingConstants;

public class SidebarPanel extends JPanel {

	public SidebarPanel() {
		this.setBackground(Color.WHITE);
		this.setBounds(0, 50, 185, 375);
		this.setLayout(null);
		
		JButton btnDashboard = new JButton("DASHBOARD");
		btnDashboard.setBounds(10, 10, 165, 35);
		this.add(btnDashboard);
		
		JButton btnAppoinments = new JButton("APPOINMENTS");
		btnAppoinments.setBounds(10, 55, 165, 35);
		this.add(btnAppoinments);
		
		JButton btnPatientInfo = new JButton("PATIENT INFO");
		btnPatientInfo.setBackground(new Color(192, 192, 192));
		btnPatientInfo.setBounds(10, 101, 164, 35);
		this.add(btnPatientInfo);
		
		JButton btnPharmacy = new JButton("PHARMACY");
		btnPharmacy.setBounds(10, 147, 165, 35);
		this.add(btnPharmacy);
		
		JButton btnDoctorReview = new JButton("DOCTOR REVIEW");
		btnDoctorReview.setBounds(10, 193, 165, 35);
		this.add(btnDoctorReview);
		
		JButton btnRestaurant = new JButton("RESTAURANT");
		btnRestaurant.setBounds(10, 239, 165, 35);
		this.add(btnRestaurant);
		
		JButton btnFinance = new JButton("FINANCE");
		btnFinance.setBounds(10, 285, 165, 35);
		this.add(btnFinance);
		
		JLabel lblNewLabel_3 = new JLabel("Made By Abdur Rahman");
		lblNewLabel_3.setForeground(Color.GRAY);
		lblNewLabel_3.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel_3.setBounds(10, 351, 165, 14);
		this.add(lblNewLabel_3);
		
		JSeparator separator_1 = new JSeparator();
		separator_1.setBounds(184, 0, 2, 376);
		this.add(separator_1);
		separator_1.setOrientation(SwingConstants.VERTICAL);
	}

}
