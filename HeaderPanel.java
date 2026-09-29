package components;

import java.awt.Color;
import java.awt.Font;

import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSeparator;
import javax.swing.JTextField;
import javax.swing.SwingConstants;

public class HeaderPanel extends JPanel {
	String title;

	public HeaderPanel(String title) {
		this.title = title;
		this.setBackground(Color.WHITE);
		this.setBounds(0, 0, 800, 50);
		this.setLayout(null);
		
		JSeparator separator = new JSeparator();
		separator.setBounds(0, 49, 800, 2);
		this.add(separator);
		
		JLabel lblNewLabel_2 = new JLabel("BMH");
		lblNewLabel_2.setForeground(Color.GRAY);
		lblNewLabel_2.setBounds(42, 4, 75, 28);
		this.add(lblNewLabel_2);
		lblNewLabel_2.setFont(new Font("Tahoma", Font.BOLD, 30));
		
		JLabel lblNewLabel = new JLabel(title);
		lblNewLabel.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel.setBounds(0, 10, 800, 28);
		this.add(lblNewLabel);
		lblNewLabel.setFont(new Font("Tahoma", Font.BOLD, 20));
		
		JLabel lblNewLabel_1 = new JLabel("Brunel Medical Hospital");
		lblNewLabel_1.setForeground(Color.GRAY);
		lblNewLabel_1.setFont(new Font("Tahoma", Font.PLAIN, 9));
		lblNewLabel_1.setBounds(30, 30, 100, 10);
		add(lblNewLabel_1);
	}
}
