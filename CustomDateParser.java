package components;

import java.time.LocalDate;
import java.time.Period;

public class CustomDateParser {
	public LocalDate userDate;
	
	public CustomDateParser(String dateString) {
		String[] dateStr = dateString.split("-");
		this.userDate = LocalDate.parse(dateStr[2]+"-"+dateStr[1]+"-"+dateStr[0]);
	}

	public String getBenifitMessage() {
		LocalDate today = LocalDate.now();
		Period period = Period.between(userDate, today);
	    if (period.getYears() > 70) {
	        return "You'll receive a free meal when you visit hospital!";
	    } else if (period.getYears() < 18 && period.getYears() >= 13) {
	    	return "You must be accompanied by an adult.";
	    } else if (period.getYears() < 13) {
	    	return "You must be accompanied by an adult and a paediatrically specialised doctor will be assigned.";
	    } else return "See you soon!";
	}
}