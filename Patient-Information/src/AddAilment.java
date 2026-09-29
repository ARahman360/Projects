import java.awt.EventQueue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.JButton;
import javax.swing.JLabel;
import java.awt.Font;
import javax.swing.JTextField;
import javax.swing.UIManager;
import javax.swing.JSeparator;
import javax.swing.JComboBox;
import javax.swing.JOptionPane;

import components.DBConn;
import components.SidebarPanel;
import components.HeaderPanel;
import components.BodyPanel;
import components.DBConn;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

public class AddAilment extends JFrame {
	Connection connection = null;
	private static final long serialVersionUID = 1L;
	private JTextField newProblemText;
	private JButton addProblemButton;

	public AddAilment() {
		setTitle("BMH : Add Ailment");
		connection = DBConn.dbConnector();
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 815, 465);
		
		JPanel contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));

		setContentPane(contentPane);
		contentPane.setLayout(null);
		
		// Header Panel
		HeaderPanel headerPanel = new HeaderPanel("Add Problem");
		contentPane.add(headerPanel);
		
		// Side bar Panel
		SidebarPanel sidebarPanel = new SidebarPanel();
		contentPane.add(sidebarPanel);
		
		// Body Panel
		BodyPanel bodyPanel = new BodyPanel();
		contentPane.add(bodyPanel);
		
		// ------ start code here ------
		
		newProblemText = new JTextField();
		newProblemText.setFont(new Font("Tahoma", Font.PLAIN, 14));
		newProblemText.setToolTipText("Search");
		newProblemText.setBounds(51, 63, 499, 35);
		bodyPanel.add(newProblemText);
		newProblemText.setColumns(10);
		
		JLabel lblRegisteredPatient = new JLabel("Add Problem");
		lblRegisteredPatient.setFont(new Font("Tahoma", Font.BOLD, 16));
		lblRegisteredPatient.setBounds(50, 11, 500, 25);
		bodyPanel.add(lblRegisteredPatient);
		
		JSeparator separator_2 = new JSeparator();
		separator_2.setBounds(2, 166, 615, 2);
		bodyPanel.add(separator_2);
		
		JLabel lblNewLabel_1_1 = new JLabel("Describe your problem:");
		lblNewLabel_1_1.setFont(new Font("Tahoma", Font.PLAIN, 14));
		lblNewLabel_1_1.setBounds(51, 36, 500, 25);
		bodyPanel.add(lblNewLabel_1_1);
		
		addProblemButton = new JButton("Add Problem");
		addProblemButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				String newProblem = newProblemText.getText();
                if ("".equals(newProblem)) {
                    JOptionPane.showMessageDialog(AddAilment.this, "Problem cannot be empty!");
                } else {
                	PreparedStatement pstmt = null;
    				String queryString = "INSERT INTO ailments(name,description) VALUES(?,?)";
    			    try {
    			        pstmt = connection.prepareStatement(queryString);
    			        pstmt.setString(1, "Custom Problem");
                		pstmt.setString(2, newProblem);
    					pstmt.executeUpdate();
    			    } catch(Exception ex) {
    					JOptionPane.showMessageDialog(null, ex);
    				} finally {
    					try {
    						pstmt.close();
    						connection.close();
    						JOptionPane.showMessageDialog(AddAilment.this, "Problem Added!");
    						dispose();
    						MedicalAilments medicalAilments = new MedicalAilments();
    						medicalAilments.setVisible(true);
    					} catch (SQLException e1) {
    						e1.printStackTrace();
    					}
            		}
                }
			}
		});
		addProblemButton.setFont(new Font("Tahoma", Font.PLAIN, 12));
		addProblemButton.setBounds(350, 109, 200, 35);
		bodyPanel.add(addProblemButton);
		
		JButton btnGoBack = new JButton("Go Back");
		btnGoBack.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				dispose();
				MedicalAilments medicalAilments = new MedicalAilments();
				medicalAilments.setVisible(true);
			}
		});
		btnGoBack.setFont(new Font("Tahoma", Font.PLAIN, 12));
		btnGoBack.setBounds(51, 308, 200, 35);
		bodyPanel.add(btnGoBack);
	}
	
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {
					UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
					AddAilment frame = new AddAilment();
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}
}
